import { describe, expect, it } from "vitest";

import type { Researcher } from "@/db/schema";
import {
  buildSearchDocument,
  type MockResearcher,
} from "@/lib/researcher-data";
import { loadMockResearchers } from "@/lib/seed";
import { normalizeSearchText, rankResearchers } from "@/lib/search";

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
});
