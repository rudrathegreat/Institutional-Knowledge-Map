import { describe, expect, it } from "vitest";

import type { Researcher } from "@/db/schema";
import seededResearchers from "@/data/researchers.json";
import seededMemberships from "@/data/research-group-memberships.json";
import seededResearchGroups from "@/data/research-groups.json";
import { buildPeopleGraph } from "@/lib/people-graph";

function researcher(
  id: string,
  name: string,
  fields: Partial<
    Pick<
      Researcher,
      "researchAreas" | "methods" | "instruments" | "software" | "keywords"
    >
  > = {},
): Researcher {
  return {
    id,
    slug: name.toLocaleLowerCase("en").replaceAll(" ", "-"),
    orcidId: null,
    orcidIdStatus: null,
    name,
    title: "Research Fellow",
    role: "Researcher",
    biography: `${name} has a stored research biography.`,
    researchAreas: fields.researchAreas ?? [`area-${id}`],
    methods: fields.methods ?? [`method-${id}`],
    instruments: fields.instruments ?? [`instrument-${id}`],
    software: fields.software ?? [`software-${id}`],
    keywords: fields.keywords ?? [`keyword-${id}`],
    searchDocument: "",
    embedding: null,
  };
}

describe("people graph derivation", () => {
  it("builds the seeded graph deterministically with explainable sparse edges", () => {
    const researchers: Researcher[] = seededResearchers.map((person) => ({
      ...person,
      orcidId: null,
      orcidIdStatus: null,
      searchDocument: "",
      embedding: null,
      researchGroups: seededMemberships
        .filter(({ researcherId }) => researcherId === person.id)
        .map(({ researchGroupId, isPrimary }) => ({
          ...seededResearchGroups.find(({ id }) => id === researchGroupId)!,
          isPrimary,
        })),
    }));

    const graph = buildPeopleGraph(researchers, seededResearchGroups);

    expect(graph.groups).toHaveLength(6);
    expect(graph.nodes).toHaveLength(30);
    expect(graph.edges).toHaveLength(42);
    expect(graph.nodes.map((node) => node.name)).toEqual(
      [...graph.nodes.map((node) => node.name)].sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    );
    expect(
      buildPeopleGraph([...researchers].reverse(), [...seededResearchGroups].reverse()),
    ).toEqual(graph);
    expect(graph.nodes[0].researchGroups).toHaveLength(1);
    expect(
      graph.nodes.find(({ id }) => id === "researcher_003")?.researchGroups,
    ).toHaveLength(2);
    expect(graph.nodes[0].primaryResearchGroupId).toBeTruthy();
    expect(new Set(graph.edges.map((edge) => edge.id))).toHaveLength(
      graph.edges.length,
    );
    expect(
      graph.edges.every(
        (edge) =>
          edge.sourceId !== edge.targetId &&
          edge.score > 0 &&
          edge.evidence.length > 0,
      ),
    ).toBe(true);
    expect(
      graph.edges.flatMap((edge) => edge.evidence).map(({ label }) => label),
    ).not.toContain("Python");

    const degrees = new Map(graph.nodes.map((node) => [node.id, 0]));
    for (const edge of graph.edges) {
      degrees.set(edge.sourceId, (degrees.get(edge.sourceId) ?? 0) + 1);
      degrees.set(edge.targetId, (degrees.get(edge.targetId) ?? 0) + 1);
    }
    expect(Math.min(...degrees.values())).toBeGreaterThanOrEqual(2);
  });

  it("scores exact shared fields case-insensitively and suppresses generic values", () => {
    const graph = buildPeopleGraph([
      researcher("alpha", "Alpha Person", {
        researchAreas: ["Pulsars"],
        methods: ["Timing"],
        instruments: ["MeerKAT"],
        software: ["Python", "TEMPO2"],
        keywords: ["Timing noise"],
      }),
      researcher("beta", "Beta Person", {
        researchAreas: ["pulsars"],
        methods: ["timing"],
        instruments: ["meerkat"],
        software: ["python", "tempo2"],
        keywords: ["timing noise"],
      }),
      researcher("gamma", "Gamma Person", { software: ["Python"] }),
      researcher("delta", "Delta Person", { software: ["Python"] }),
      researcher("epsilon", "Epsilon Person", { software: ["Python"] }),
    ]);

    const edge = graph.edges.find((candidate) => candidate.id === "alpha--beta");

    expect(edge).toMatchObject({
      score: 15,
      evidence: [
        { category: "research area", label: "Pulsars" },
        { category: "method", label: "Timing" },
        { category: "keyword", label: "Timing noise" },
        { category: "instrument", label: "MeerKAT" },
        { category: "software", label: "TEMPO2" },
      ],
    });
    expect(edge?.evidence.map(({ label }) => label)).not.toContain("Python");
  });

  it("keeps isolated researchers visible without fabricating an edge", () => {
    const graph = buildPeopleGraph([
      researcher("one", "One Person"),
      researcher("two", "Two Person"),
      researcher("three", "Three Person"),
    ]);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toEqual([]);
  });

  it("retains primary and secondary research-group tags", () => {
    const groupedResearcher = {
      ...researcher("one", "One Person"),
      researchGroups: [
        { id: "alpha", name: "Alpha Group", isPrimary: true },
        { id: "beta", name: "Beta Group", isPrimary: false },
      ],
    };
    const graph = buildPeopleGraph(
      [groupedResearcher, researcher("two", "Two Person")],
      [
        { id: "beta", name: "Beta Group" },
        { id: "alpha", name: "Alpha Group" },
      ],
    );

    expect(graph.groups.map(({ name }) => name)).toEqual([
      "Alpha Group",
      "Beta Group",
    ]);
    expect(graph.nodes.find(({ id }) => id === "one")).toMatchObject({
      primaryResearchGroupId: "alpha",
      researchGroups: groupedResearcher.researchGroups,
    });
    expect(
      graph.nodes.find(({ id }) => id === "two")?.primaryResearchGroupId,
    ).toBeUndefined();
  });
});
