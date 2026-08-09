import type { Researcher } from "@/db/schema";

export type GraphEvidenceCategory =
  | "research area"
  | "method"
  | "keyword"
  | "instrument"
  | "software";

export interface SharedEvidence {
  category: GraphEvidenceCategory;
  label: string;
}

export interface PeopleGraphNode {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
}

export interface PeopleGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
  evidence: SharedEvidence[];
}

export interface PeopleGraph {
  nodes: PeopleGraphNode[];
  edges: PeopleGraphEdge[];
}

type ResearcherListField =
  | "researchAreas"
  | "methods"
  | "keywords"
  | "instruments"
  | "software";

interface EvidenceField {
  field: ResearcherListField;
  category: GraphEvidenceCategory;
  weight: number;
}

interface CandidateEdge extends PeopleGraphEdge {
  sourceName: string;
  targetName: string;
}

const EVIDENCE_FIELDS: EvidenceField[] = [
  { field: "researchAreas", category: "research area", weight: 5 },
  { field: "methods", category: "method", weight: 4 },
  { field: "keywords", category: "keyword", weight: 3 },
  { field: "instruments", category: "instrument", weight: 2 },
  { field: "software", category: "software", weight: 1 },
];

const CONNECTIONS_PER_PERSON = 2;

function normalizeValue(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function evidenceKey(category: GraphEvidenceCategory, value: string): string {
  return `${category}:${normalizeValue(value)}`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function edgeId(leftId: string, rightId: string): string {
  return [leftId, rightId].sort(compareText).join("--");
}

function findGenericEvidence(researchers: Researcher[]): Set<string> {
  const documentFrequency = new Map<string, number>();

  for (const researcher of researchers) {
    for (const { category, field } of EVIDENCE_FIELDS) {
      const uniqueValues = new Set(
        researcher[field].map((value) => evidenceKey(category, value)),
      );

      for (const key of uniqueValues) {
        documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
      }
    }
  }

  const genericEvidence = new Set<string>();
  for (const [key, frequency] of documentFrequency) {
    if (frequency > researchers.length / 2) {
      genericEvidence.add(key);
    }
  }

  return genericEvidence;
}

function buildCandidateEdge(
  left: Researcher,
  right: Researcher,
  genericEvidence: Set<string>,
): CandidateEdge | undefined {
  const evidence: SharedEvidence[] = [];
  let score = 0;

  for (const { category, field, weight } of EVIDENCE_FIELDS) {
    const rightValues = new Set(right[field].map(normalizeValue));
    const sharedValues = left[field]
      .filter((value) => rightValues.has(normalizeValue(value)))
      .filter((value) => !genericEvidence.has(evidenceKey(category, value)))
      .sort(compareText);

    for (const label of sharedValues) {
      evidence.push({ category, label });
      score += weight;
    }
  }

  if (evidence.length === 0) {
    return undefined;
  }

  return {
    id: edgeId(left.id, right.id),
    sourceId: left.id,
    targetId: right.id,
    sourceName: left.name,
    targetName: right.name,
    score,
    evidence,
  };
}

function counterpartName(edge: CandidateEdge, researcherId: string): string {
  return edge.sourceId === researcherId ? edge.targetName : edge.sourceName;
}

function compareCandidateEdges(
  left: CandidateEdge,
  right: CandidateEdge,
  researcherId: string,
): number {
  return (
    right.score - left.score ||
    right.evidence.length - left.evidence.length ||
    compareText(
      counterpartName(left, researcherId),
      counterpartName(right, researcherId),
    ) ||
    compareText(left.id, right.id)
  );
}

export function buildPeopleGraph(researchers: Researcher[]): PeopleGraph {
  const sortedResearchers = [...researchers].sort(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.id, right.id),
  );
  const genericEvidence = findGenericEvidence(sortedResearchers);
  const candidates: CandidateEdge[] = [];

  for (let leftIndex = 0; leftIndex < sortedResearchers.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedResearchers.length;
      rightIndex += 1
    ) {
      const candidate = buildCandidateEdge(
        sortedResearchers[leftIndex],
        sortedResearchers[rightIndex],
        genericEvidence,
      );

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  const selectedEdgeIds = new Set<string>();
  for (const researcher of sortedResearchers) {
    candidates
      .filter(
        (edge) =>
          edge.sourceId === researcher.id || edge.targetId === researcher.id,
      )
      .sort((left, right) =>
        compareCandidateEdges(left, right, researcher.id),
      )
      .slice(0, CONNECTIONS_PER_PERSON)
      .forEach((edge) => selectedEdgeIds.add(edge.id));
  }

  const edges = candidates
    .filter((edge) => selectedEdgeIds.has(edge.id))
    .map(({ id, sourceId, targetId, score, evidence }) => ({
      id,
      sourceId,
      targetId,
      score,
      evidence,
    }))
    .sort((left, right) => compareText(left.id, right.id));

  return {
    nodes: sortedResearchers.map(
      ({ id, slug, name, title, role, researchAreas }) => ({
        id,
        slug,
        name,
        title,
        role,
        researchAreas,
      }),
    ),
    edges,
  };
}
