import { describe, expect, it } from "vitest";

import type { OrcidWork, Researcher } from "@/db/schema";
import type { ResearchGroupSummary } from "@/lib/api-types";
import {
  buildSearchDocument,
  type MockResearcher,
} from "@/lib/researcher-data";
import {
  loadMockOrcidRecords,
  loadMockResearchGroupMemberships,
  loadMockResearchGroups,
  loadMockResearchers,
} from "@/lib/seed";
import {
  buildExpertiseVocabulary,
  MAX_PUBLICATION_SCORE,
  normalizeSearchText,
  rankResearchers,
  scorePublicationEvidence,
  validateInterpretedTerms,
} from "@/lib/search";

const mockResearchers = loadMockResearchers();
const mockResearchGroups = loadMockResearchGroups();
const mockGroupMemberships = loadMockResearchGroupMemberships();
const researchGroupById = new Map(
  mockResearchGroups.map((group) => [group.id, group]),
);
const records: Array<Researcher & { researchGroups: ResearchGroupSummary[] }> = mockResearchers.map(
  (researcher: MockResearcher) => ({
    ...researcher,
    orcidId: null,
    orcidIdStatus: null,
    searchDocument: buildSearchDocument(researcher),
    embedding: null,
    researchGroups: mockGroupMemberships
      .filter(({ researcherId }) => researcherId === researcher.id)
      .map(({ researchGroupId, isPrimary }) => ({
        ...researchGroupById.get(researchGroupId)!,
        isPrimary,
      })),
  }),
);
const publications: OrcidWork[] = loadMockOrcidRecords().flatMap((record) =>
  record.works.map((work) => ({
    ...work,
    researcherId: record.researcherId,
    externalIdType: null,
    externalIdValue: null,
    externalUrl: null,
    dataSource: "mock" as const,
  })),
);

describe("lexical researcher ranking", () => {
  it("normalizes case, punctuation, whitespace, and accents", () => {
    expect(normalizeSearchText("  MéerKAT — Timing!  ")).toBe(
      "meerkat timing",
    );
  });

  it("returns an exact researcher name first", () => {
    const results = rankResearchers(records, "Maya Chen");

    expect(results[0]?.id).toBe("researcher_001");
    expect(results[0]?.reason).toContain("exact match");
  });

  it.each([
    ["pulsars", "researcher_001"],
    ["Bayesian modelling", "researcher_003"],
    ["MeerKAT", "researcher_002"],
    ["TEMPO2", "researcher_001"],
    ["scintillation", "researcher_002"],
  ])("finds plausible matches for %s", (query, expectedId) => {
    const results = rankResearchers(records, query);

    expect(results.map((result) => result.id)).toContain(expectedId);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns multiple plausible people for overlapping expertise", () => {
    const results = rankResearchers(records, "gravitational waves Bayesian");

    expect(results.length).toBeGreaterThan(1);
  });

  it("returns no records when no profile terms match", () => {
    expect(
      rankResearchers(records, "quantum polymer nanofabrication"),
    ).toEqual([]);
  });

  it("only returns identities present in the database source", () => {
    const storedIds = new Set(records.map((researcher) => researcher.id));
    const results = rankResearchers(records, "radio astronomy");

    expect(results.every((result) => storedIds.has(result.id))).toBe(true);
  });

  it("builds a unique vocabulary from controlled expertise fields", () => {
    const vocabulary = buildExpertiseVocabulary(records);

    expect(vocabulary).toContain("Pulsar Astronomer");
    expect(vocabulary).toContain("pulsar timing");
    expect(vocabulary).toContain("MeerKAT");
    expect(vocabulary).toContain("TEMPO2");
    expect(vocabulary).not.toContain("Maya Chen");
    expect(vocabulary).not.toContain(
      "Long-baseline pulsar timing constraints on rotational noise with MeerKAT",
    );
    expect(vocabulary).not.toContain("Radio Astronomy & Pulsars");
    expect(vocabulary.filter((term) => term === "Python")).toHaveLength(1);
  });

  it("retrieves group members from a raw research-group query", () => {
    const results = rankResearchers(records, "Radio Astronomy & Pulsars");

    expect(results).toHaveLength(5);
    expect(
      results.every((result) =>
        result.researchGroups.some(({ id }) => id === "group_radio_pulsars"),
      ),
    ).toBe(true);
    expect(results[0]?.reason).toContain(
      "Radio Astronomy & Pulsars research group",
    );
    expect(results[0]?.evidence.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "researchGroup",
          value: "Radio Astronomy & Pulsars",
          origins: ["query"],
        }),
      ]),
    );
  });

  it("validates and deduplicates interpreted terms against the vocabulary", () => {
    expect(
      validateInterpretedTerms(records, [
        "meerKAT",
        "MeerKAT",
        "invented expertise",
        "pulsar timing",
      ]),
    ).toEqual(["MeerKAT", "pulsar timing"]);
  });

  it("finds a vocabulary-mismatch query through controlled expansion", () => {
    const query = "one-off mysterious beacon";

    expect(rankResearchers(records, query)).toEqual([]);
    expect(
      rankResearchers(records, query, ["fast radio bursts", "dedispersion"])[0]
        ?.id,
    ).toBe("researcher_006");
  });

  it("finds and explains a researcher from publication-title evidence", () => {
    const results = rankResearchers(
      records,
      "chromatic scintillation arcs",
      [],
      publications,
    );

    expect(results[0]?.id).toBe("researcher_002");
    expect(results[0]?.reason).toContain("recent listed demo publication");
    expect(results[0]?.reason).toContain("Chromatic scintillation arcs");
  });

  it("caps accumulated publication-title evidence", () => {
    const repeatedMatches = Array.from({ length: 20 }, (_, index) => ({
      ...publications[0],
      id: `repeated-${index}`,
      title: `Radio timing study ${index}`,
    }));

    expect(
      scorePublicationEvidence(repeatedMatches, "radio", ["radio"]).score,
    ).toBe(MAX_PUBLICATION_SCORE);
  });

  it("keeps curated expertise stronger than a publication token match", () => {
    const results = rankResearchers(records, "scintillation", [], publications);

    expect(results[0]?.id).toBe("researcher_002");
    expect(results[0]?.reason).toContain("stored profile");
  });

  it("weights expanded evidence below raw-query evidence", () => {
    const results = rankResearchers(records, "pulsar timing", [
      "scintillation analysis",
    ]);

    expect(results[0]?.id).toBe("researcher_001");
    expect(results.map((result) => result.id)).toContain("researcher_002");
  });

  it("keeps an exact full-name match first despite unrelated expansion", () => {
    const results = rankResearchers(records, "Maya Chen", [
      "fast radio bursts",
      "dedispersion",
      "radio localisation",
    ]);

    expect(results[0]?.id).toBe("researcher_001");
  });

  it("returns the stored evidence needed for grounded explanations", () => {
    const result = rankResearchers(records, "Maya Chen", [], publications)[0];

    expect(result?.evidence).toMatchObject({
      biography: expect.stringContaining("long-baseline pulsar timing"),
      methods: expect.arrayContaining(["pulsar timing"]),
      instruments: expect.arrayContaining(["MeerKAT"]),
      software: expect.arrayContaining(["TEMPO2"]),
      keywords: expect.arrayContaining(["timing noise"]),
      publications: expect.arrayContaining([
        expect.objectContaining({
          title:
            "Long-baseline pulsar timing constraints on rotational noise with MeerKAT",
          dataSource: "mock",
        }),
      ]),
      matches: expect.arrayContaining([
        expect.objectContaining({
          category: "name",
          value: "Maya Chen",
          origins: ["query"],
        }),
      ]),
    });
  });

  it("traces only structured values and profile sentences that contributed", () => {
    const result = rankResearchers(records, "MeerKAT").find(
      (candidate) => candidate.id === "researcher_001",
    );

    expect(result?.evidence.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "instrument",
          value: "MeerKAT",
          origins: ["query"],
          matchedTerms: ["MeerKAT"],
        }),
        expect.objectContaining({
          category: "biography",
          value: expect.stringContaining("MeerKAT"),
          origins: ["query"],
        }),
      ]),
    );
    expect(result?.evidence.matches).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "software", value: "TEMPO2" }),
      ]),
    );
  });

  it("labels interpreted-only evidence and merges overlapping provenance", () => {
    const interpretedOnly = rankResearchers(
      records,
      "one-off mysterious beacon",
      ["fast radio bursts", "dedispersion"],
    )[0];
    const interpretedResearchArea = interpretedOnly?.evidence.matches.find(
      (match) =>
        match.category === "researchArea" &&
        match.value === "fast radio bursts",
    );

    expect(interpretedResearchArea).toMatchObject({
      origins: ["interpreted"],
      matchedTerms: ["fast radio bursts"],
    });

    const overlapping = rankResearchers(records, "pulsars", ["pulsars"])[0];
    const overlappingResearchArea = overlapping?.evidence.matches.find(
      (match) => match.category === "researchArea" && match.value === "pulsars",
    );

    expect(overlappingResearchArea).toMatchObject({
      origins: ["query", "interpreted"],
      matchedTerms: ["pulsars"],
    });
  });

  it("returns matched publication metadata rather than unrelated recent works", () => {
    const result = rankResearchers(
      records,
      "chromatic scintillation arcs",
      [],
      publications,
    )[0];
    const publicationMatches = result?.evidence.matches.filter(
      (match) => match.category === "publication",
    );

    expect(publicationMatches).toEqual([
      expect.objectContaining({
        origins: ["query"],
        publication: expect.objectContaining({
          title: expect.stringContaining("Chromatic scintillation arcs"),
          dataSource: "mock",
        }),
      }),
    ]);
  });

  it("uses a matched biography sentence instead of the full profile", () => {
    const result = rankResearchers(
      records,
      "turning repeated radio observations",
    ).find((candidate) => candidate.id === "researcher_001");
    const excerpt = result?.evidence.matches.find(
      (match) => match.category === "biography",
    )?.value;

    expect(excerpt).toContain("turning repeated radio observations");
    expect(excerpt).not.toBe(result?.evidence.biography);
  });
});
