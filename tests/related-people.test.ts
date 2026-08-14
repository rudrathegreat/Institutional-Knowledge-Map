import { describe, expect, it } from "vitest";

import type { ResearcherWithGroups } from "@/lib/research-groups";
import { deriveRelatedPeople } from "@/lib/related-people";

type ExpertiseFields = Pick<
  ResearcherWithGroups,
  "researchAreas" | "methods" | "instruments" | "software" | "keywords"
>;

interface PersonOptions extends Partial<ExpertiseFields> {
  groups?: ResearcherWithGroups["researchGroups"];
}

function group(id: string, isPrimary: boolean) {
  return {
    id,
    slug: `${id}-group`,
    name: `${id.toLocaleUpperCase("en")} Group`,
    isPrimary,
  };
}

function person(
  id: string,
  name: string,
  options: PersonOptions = {},
): ResearcherWithGroups {
  return {
    id,
    slug: name.toLocaleLowerCase("en").replaceAll(" ", "-"),
    orcidId: null,
    orcidIdStatus: null,
    name,
    title: "Research Fellow",
    role: "Researcher",
    biography: `${name} has a stored research biography.`,
    researchAreas: options.researchAreas ?? [`area-${id}`],
    methods: options.methods ?? [`method-${id}`],
    instruments: options.instruments ?? [`instrument-${id}`],
    software: options.software ?? [`software-${id}`],
    keywords: options.keywords ?? [`keyword-${id}`],
    searchDocument: "",
    embedding: null,
    researchGroups: options.groups ?? [],
  };
}

describe("related people derivation", () => {
  it("weights primary and secondary group memberships before deterministic ties", () => {
    const source = person("source", "Source Person", {
      groups: [group("alpha", true), group("beta", false)],
    });
    const people = [
      source,
      person("secondary", "A Secondary Person", {
        groups: [group("beta", false)],
      }),
      person("one-primary", "A One Primary Person", {
        groups: [group("beta", true)],
      }),
      person("primary", "Z Primary Person", {
        groups: [group("alpha", true)],
      }),
      person("multi", "Z Multi Group Person", {
        groups: [group("alpha", false), group("beta", false)],
      }),
    ];

    const related = deriveRelatedPeople(source.id, people, 4);

    expect(related.byConnection.map(({ id }) => id)).toEqual([
      "multi",
      "primary",
      "one-primary",
      "secondary",
    ]);
    expect(related.byConnection[0].sharedGroups).toHaveLength(2);
  });

  it("ranks normalized structured expertise and suppresses generic values", () => {
    const source = person("source", "Source Person", {
      researchAreas: ["Pulsars"],
      methods: ["Timing"],
      keywords: ["Timing noise"],
      instruments: ["MeerKAT"],
      software: ["TEMPO2", "Python"],
    });
    const people = [
      source,
      person("area", "Area Person", { researchAreas: ["pulsars"] }),
      person("method-software", "Method Software Person", {
        methods: ["timing"],
        software: ["tempo2"],
      }),
      person("keyword", "Keyword Person", { keywords: ["timing noise"] }),
      person("generic", "Generic Person", { software: ["python"] }),
      person("filler-one", "Filler One", { software: ["Python"] }),
      person("filler-two", "Filler Two", { software: ["PYTHON"] }),
    ];

    const related = deriveRelatedPeople(source.id, people, 10);

    expect(related.byContent.map(({ id }) => id)).toEqual([
      "method-software",
      "area",
      "keyword",
    ]);
    expect(related.byContent[0].sharedEvidence).toEqual([
      { category: "method", label: "Timing" },
      { category: "software", label: "TEMPO2" },
    ]);
    expect(
      related.byContent.flatMap(({ sharedEvidence }) => sharedEvidence),
    ).not.toContainEqual({ category: "software", label: "Python" });
  });

  it("prefers new content contacts and backfills with the strongest overlap", () => {
    const source = person("source", "Source Person", {
      researchAreas: ["Connected topic"],
      methods: ["Unique method"],
      keywords: ["Connected keyword"],
      instruments: ["Unique instrument"],
      groups: [group("alpha", true)],
    });
    const people = [
      source,
      person("connection-strong", "Connected Strong", {
        researchAreas: ["connected topic"],
        groups: [group("alpha", true)],
      }),
      person("connection-second", "Connected Second", {
        keywords: ["connected keyword"],
        groups: [group("alpha", true)],
      }),
      person("unique-one", "Unique One", { methods: ["unique method"] }),
      person("unique-two", "Unique Two", {
        instruments: ["unique instrument"],
      }),
    ];

    const related = deriveRelatedPeople(source.id, people, 3);

    expect(related.byConnection.map(({ id }) => id)).toEqual([
      "connection-strong",
      "connection-second",
    ]);
    expect(related.byContent.map(({ id }) => id)).toEqual([
      "unique-one",
      "unique-two",
      "connection-strong",
    ]);
    expect(new Set(related.byContent.map(({ id }) => id))).toHaveLength(3);
  });

  it("excludes the source, limits results, and handles missing candidates", () => {
    const source = person("source", "Source Person", {
      researchAreas: ["Shared area"],
    });
    const people = [
      person("beta", "Beta Person", { researchAreas: ["shared area"] }),
      source,
      person("alpha", "Alpha Person", { researchAreas: ["SHARED AREA"] }),
      person("filler-one", "Filler One"),
      person("filler-two", "Filler Two"),
      person("filler-three", "Filler Three"),
    ];

    expect(deriveRelatedPeople(source.id, people, 1).byContent).toMatchObject([
      { id: "alpha" },
    ]);
    expect(deriveRelatedPeople(source.id, [source])).toEqual({
      byConnection: [],
      byContent: [],
    });
    expect(deriveRelatedPeople("unknown", people)).toEqual({
      byConnection: [],
      byContent: [],
    });
  });
});
