import { describe, expect, it } from "vitest";

import type { ResearchGroup } from "@/db/schema";
import { rankResearchGroups } from "@/lib/research-group-search";
import { loadMockResearchGroups } from "@/lib/seed";

const groups = loadMockResearchGroups();
const memberCounts = new Map(groups.map((group, index) => [group.id, index + 1]));

describe("research-group ranking", () => {
  it("returns an exact group-name match first with traced evidence", () => {
    const results = rankResearchGroups(
      groups,
      "Radio Astronomy & Pulsars",
      [],
      memberCounts,
    );

    expect(results[0]).toMatchObject({
      id: "group_radio_pulsars",
      slug: "radio-astronomy-pulsars",
      memberCount: 1,
      reason: expect.stringContaining("exact match"),
      evidence: {
        matches: expect.arrayContaining([
          expect.objectContaining({
            category: "name",
            value: "Radio Astronomy & Pulsars",
            origins: ["query"],
          }),
        ]),
      },
    });
  });

  it("finds a group from curated focus areas and summary text", () => {
    const focusResult = rankResearchGroups(groups, "fast radio bursts")[0];
    const summaryResult = rankResearchGroups(groups, "scientific workflows")[0];

    expect(focusResult?.id).toBe("group_transients");
    expect(focusResult?.reason).toContain("fast radio bursts");
    expect(summaryResult?.id).toBe("group_data_methods");
    expect(summaryResult?.evidence.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "summary", origins: ["query"] }),
      ]),
    );
  });

  it("uses controlled interpreted terms at reduced weight with provenance", () => {
    const result = rankResearchGroups(
      groups,
      "one-off mysterious beacon",
      ["fast radio bursts"],
    )[0];

    expect(result?.id).toBe("group_transients");
    expect(result?.evidence.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "researchArea",
          value: "fast radio bursts",
          origins: ["interpreted"],
          matchedTerms: ["fast radio bursts"],
        }),
      ]),
    );
  });

  it("returns no group when no curated field matches", () => {
    expect(rankResearchGroups(groups, "quantum polymer nanofabrication")).toEqual(
      [],
    );
  });

  it("caps results at two with deterministic alphabetical tie-breaking", () => {
    const tiedGroups: ResearchGroup[] = ["Zulu", "Alpha", "Beta"].map(
      (name) => ({
        id: name.toLowerCase(),
        slug: name.toLowerCase(),
        name: `${name} Group`,
        summary: "Shared telescope programme.",
        researchAreas: ["shared topic"],
      }),
    );

    expect(rankResearchGroups(tiedGroups, "shared topic").map(({ id }) => id)).toEqual(
      ["alpha", "beta"],
    );
  });
});
