import type { Researcher, ResearchGroup } from "@/db/schema";
import type { ResearchGroupSummary } from "@/lib/api-types";
import {
  compareSharedExpertise,
  findGenericExpertiseEvidence,
  type SharedEvidence,
  type SharedExpertiseCategory,
} from "@/lib/shared-expertise";

export type GraphEvidenceCategory = SharedExpertiseCategory;
export type { SharedEvidence } from "@/lib/shared-expertise";

export interface PeopleGraphNode {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchGroups: ResearchGroupSummary[];
  primaryResearchGroupId?: string;
  researchAreas: string[];
}

export interface PeopleGraphResearchGroup {
  id: string;
  name: string;
}

export interface PeopleGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
  evidence: SharedEvidence[];
}

export interface PeopleGraph {
  groups: PeopleGraphResearchGroup[];
  nodes: PeopleGraphNode[];
  edges: PeopleGraphEdge[];
}

type GraphResearcher = Researcher & {
  researchGroups?: ResearchGroupSummary[];
};

interface CandidateEdge extends PeopleGraphEdge {
  sourceName: string;
  targetName: string;
}

const CONNECTIONS_PER_PERSON = 2;

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function edgeId(leftId: string, rightId: string): string {
  return [leftId, rightId].sort(compareText).join("--");
}

function buildCandidateEdge(
  left: Researcher,
  right: Researcher,
  genericEvidence: Set<string>,
): CandidateEdge | undefined {
  const { score, evidence } = compareSharedExpertise(
    left,
    right,
    genericEvidence,
  );

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

export function buildPeopleGraph(
  researchers: GraphResearcher[],
  researchGroups: Array<Pick<ResearchGroup, "id" | "name">> = [],
): PeopleGraph {
  const sortedResearchers = [...researchers].sort(
    (left, right) =>
      compareText(left.name, right.name) || compareText(left.id, right.id),
  );
  const genericEvidence = findGenericExpertiseEvidence(sortedResearchers);
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
    groups: [...researchGroups]
      .map(({ id, name }) => ({ id, name }))
      .sort((left, right) => compareText(left.name, right.name)),
    nodes: sortedResearchers.map(
      ({ id, slug, name, title, role, researchAreas, researchGroups = [] }) => ({
        id,
        slug,
        name,
        title,
        role,
        researchGroups,
        primaryResearchGroupId: researchGroups.find(({ isPrimary }) => isPrimary)
          ?.id,
        researchAreas,
      }),
    ),
    edges,
  };
}
