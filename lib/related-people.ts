import type { ResearchGroupSummary } from "@/lib/api-types";
import type { ResearcherWithGroups } from "@/lib/research-groups";
import {
  compareSharedExpertise,
  findGenericExpertiseEvidence,
  type SharedEvidence,
  type SharedExpertiseComparison,
} from "@/lib/shared-expertise";

export const RELATED_PEOPLE_LIMIT = 3;

interface RelatedPersonIdentity {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
}

export interface SharedResearchGroup
  extends Omit<ResearchGroupSummary, "isPrimary"> {
  sourceIsPrimary: boolean;
  relatedPersonIsPrimary: boolean;
}

export interface ConnectionRelatedPerson extends RelatedPersonIdentity {
  sharedGroups: SharedResearchGroup[];
}

export interface ContentRelatedPerson extends RelatedPersonIdentity {
  sharedEvidence: SharedEvidence[];
}

export interface RelatedPeople {
  byConnection: ConnectionRelatedPerson[];
  byContent: ContentRelatedPerson[];
}

interface ComparedCandidate {
  person: ResearcherWithGroups;
  content: SharedExpertiseComparison;
}

interface ConnectionCandidate extends ComparedCandidate {
  affiliationScore: number;
  sharedGroups: SharedResearchGroup[];
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function toIdentity(person: ResearcherWithGroups): RelatedPersonIdentity {
  return {
    id: person.id,
    slug: person.slug,
    name: person.name,
    title: person.title,
    role: person.role,
  };
}

function findSharedGroups(
  source: ResearcherWithGroups,
  candidate: ResearcherWithGroups,
): SharedResearchGroup[] {
  const candidateGroups = new Map(
    candidate.researchGroups.map((group) => [group.id, group]),
  );

  return source.researchGroups
    .flatMap((sourceGroup) => {
      const candidateGroup = candidateGroups.get(sourceGroup.id);

      if (!candidateGroup) {
        return [];
      }

      return [
        {
          id: sourceGroup.id,
          slug: sourceGroup.slug,
          name: sourceGroup.name,
          sourceIsPrimary: sourceGroup.isPrimary,
          relatedPersonIsPrimary: candidateGroup.isPrimary,
        },
      ];
    })
    .sort(
      (left, right) =>
        compareText(left.name, right.name) || compareText(left.id, right.id),
    );
}

function scoreAffiliations(sharedGroups: SharedResearchGroup[]): number {
  return sharedGroups.reduce((score, group) => {
    if (group.sourceIsPrimary && group.relatedPersonIsPrimary) {
      return score + 3;
    }

    if (group.sourceIsPrimary || group.relatedPersonIsPrimary) {
      return score + 2;
    }

    return score + 1;
  }, 0);
}

function compareContentCandidates(
  left: ComparedCandidate,
  right: ComparedCandidate,
): number {
  return (
    right.content.score - left.content.score ||
    right.content.evidence.length - left.content.evidence.length ||
    compareText(left.person.name, right.person.name) ||
    compareText(left.person.id, right.person.id)
  );
}

function compareConnectionCandidates(
  left: ConnectionCandidate,
  right: ConnectionCandidate,
): number {
  return (
    right.affiliationScore - left.affiliationScore ||
    right.sharedGroups.length - left.sharedGroups.length ||
    compareContentCandidates(left, right)
  );
}

function normalizeLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 0;
}

export function deriveRelatedPeople(
  researcherId: string,
  researchers: ResearcherWithGroups[],
  limit = RELATED_PEOPLE_LIMIT,
): RelatedPeople {
  const normalizedLimit = normalizeLimit(limit);
  const source = researchers.find(({ id }) => id === researcherId);

  if (!source || normalizedLimit === 0) {
    return { byConnection: [], byContent: [] };
  }

  const genericEvidence = findGenericExpertiseEvidence(researchers);
  const comparedCandidates: ComparedCandidate[] = researchers
    .filter(({ id }) => id !== researcherId)
    .map((person) => ({
      person,
      content: compareSharedExpertise(source, person, genericEvidence),
    }));

  const connectionCandidates = comparedCandidates
    .map((candidate): ConnectionCandidate => {
      const sharedGroups = findSharedGroups(source, candidate.person);

      return {
        ...candidate,
        sharedGroups,
        affiliationScore: scoreAffiliations(sharedGroups),
      };
    })
    .filter(({ sharedGroups }) => sharedGroups.length > 0)
    .sort(compareConnectionCandidates);

  const byConnection = connectionCandidates
    .slice(0, normalizedLimit)
    .map(({ person, sharedGroups }) => ({
      ...toIdentity(person),
      sharedGroups,
    }));

  const displayedConnectionIds = new Set(
    byConnection.map(({ id }) => id),
  );
  const contentCandidates = comparedCandidates
    .filter(({ content }) => content.score > 0)
    .sort(compareContentCandidates);
  const uniqueContentCandidates = contentCandidates.filter(
    ({ person }) => !displayedConnectionIds.has(person.id),
  );
  const overlappingContentCandidates = contentCandidates.filter(({ person }) =>
    displayedConnectionIds.has(person.id),
  );

  const byContent = [
    ...uniqueContentCandidates,
    ...overlappingContentCandidates,
  ]
    .slice(0, normalizedLimit)
    .map(({ person, content }) => ({
      ...toIdentity(person),
      sharedEvidence: content.evidence,
    }));

  return { byConnection, byContent };
}
