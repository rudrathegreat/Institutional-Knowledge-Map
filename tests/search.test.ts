import { describe, expect, it } from "vitest";

import type { Researcher } from "@/db/schema";
import {
  buildSearchDocument,
  type MockResearcher,
} from "@/lib/researcher-data";
import { loadMockResearchers } from "@/lib/seed";
import {
  buildExpertiseVocabulary,
  normalizeSearchText,
  rankResearchers,
  validateInterpretedTerms,
} from "@/lib/search";

const mockResearchers = loadMockResearchers();
const records: Researcher[] = mockResearchers.map(
  (researcher: MockResearcher) => ({
    ...researcher,
    searchDocument: buildSearchDocument(researcher),
    embedding: null,
  }),
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
    expect(vocabulary.filter((term) => term === "Python")).toHaveLength(1);
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
    const result = rankResearchers(records, "Maya Chen")[0];

    expect(result?.evidence).toMatchObject({
      biography: expect.stringContaining("long-baseline pulsar timing"),
      methods: expect.arrayContaining(["pulsar timing"]),
      instruments: expect.arrayContaining(["MeerKAT"]),
      software: expect.arrayContaining(["TEMPO2"]),
      keywords: expect.arrayContaining(["timing noise"]),
    });
  });
});
