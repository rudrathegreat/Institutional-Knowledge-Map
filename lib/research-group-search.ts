import type { ResearchGroup } from "@/db/schema";
import type {
  ResearchGroupEvidenceCategory,
  ResearchGroupEvidenceMatchPayload,
  ResearchGroupSearchResultPayload,
  SearchEvidenceOrigin,
} from "@/lib/api-types";
import { normalizeSearchText } from "@/lib/search-text";

export const RESEARCH_GROUP_RESULT_LIMIT = 2;

const STOP_WORDS = new Set([
  "a",
  "about",
  "am",
  "an",
  "and",
  "are",
  "for",
  "i",
  "in",
  "is",
  "know",
  "knows",
  "me",
  "my",
  "of",
  "on",
  "or",
  "should",
  "talk",
  "the",
  "to",
  "what",
  "who",
  "with",
]);

interface MutableGroupEvidenceMatch {
  category: ResearchGroupEvidenceCategory;
  value: string;
  origins: Set<SearchEvidenceOrigin>;
  matchedTerms: Map<string, string>;
}

interface RankedResearchGroup {
  group: ResearchGroup;
  score: number;
  matchedFieldCount: number;
  exactNameMatch: boolean;
  matchingEvidence: ResearchGroupEvidenceMatchPayload[];
}

function getQueryTokens(normalizedQuery: string): string[] {
  const allTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const meaningfulTokens = allTokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token),
  );

  return meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;
}

function addEvidenceMatch(
  matches: Map<string, MutableGroupEvidenceMatch>,
  category: ResearchGroupEvidenceCategory,
  value: string,
  origin: SearchEvidenceOrigin,
  matchedTerm: string,
): void {
  const key = `${category}:${normalizeSearchText(value)}`;
  const currentMatch = matches.get(key) ?? {
    category,
    value,
    origins: new Set<SearchEvidenceOrigin>(),
    matchedTerms: new Map<string, string>(),
  };
  const normalizedTerm = normalizeSearchText(matchedTerm);

  currentMatch.origins.add(origin);
  if (normalizedTerm && !currentMatch.matchedTerms.has(normalizedTerm)) {
    currentMatch.matchedTerms.set(normalizedTerm, matchedTerm.trim());
  }
  matches.set(key, currentMatch);
}

function finalizeEvidenceMatches(
  matches: Map<string, MutableGroupEvidenceMatch>,
): ResearchGroupEvidenceMatchPayload[] {
  return [...matches.values()].map((match) => ({
    category: match.category,
    value: match.value,
    origins: [...match.origins],
    matchedTerms: [...match.matchedTerms.values()],
  }));
}

function mergeEvidenceMatches(
  ...groups: ResearchGroupEvidenceMatchPayload[][]
): ResearchGroupEvidenceMatchPayload[] {
  const merged = new Map<string, MutableGroupEvidenceMatch>();

  for (const match of groups.flat()) {
    for (const origin of match.origins) {
      for (const term of match.matchedTerms) {
        addEvidenceMatch(merged, match.category, match.value, origin, term);
      }
    }
  }

  return finalizeEvidenceMatches(merged);
}

function rankResearchGroupTerm(
  group: ResearchGroup,
  normalizedQuery: string,
  tokens: string[],
  origin: SearchEvidenceOrigin,
  matchedTerm: string,
): RankedResearchGroup {
  let score = 0;
  const matchedFields = new Set<string>();
  const matchingEvidence = new Map<string, MutableGroupEvidenceMatch>();
  const normalizedName = normalizeSearchText(group.name);
  const exactNameMatch = normalizedName === normalizedQuery;
  let nameMatched = false;

  if (exactNameMatch) {
    score += 1_000;
    nameMatched = true;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 180;
    nameMatched = true;
  }

  for (const token of tokens) {
    if (normalizedName.includes(token)) {
      score += 30;
      nameMatched = true;
    }
  }

  if (nameMatched) {
    matchedFields.add("name");
    addEvidenceMatch(matchingEvidence, "name", group.name, origin, matchedTerm);
  }

  for (const area of group.researchAreas) {
    const normalizedArea = normalizeSearchText(area);
    let areaMatched = false;

    if (normalizedArea === normalizedQuery) {
      score += 140;
      areaMatched = true;
    } else if (normalizedArea.includes(normalizedQuery)) {
      score += 80;
      areaMatched = true;
    }

    for (const token of tokens) {
      if (normalizedArea.includes(token)) {
        score += 16;
        areaMatched = true;
      }
    }

    if (areaMatched) {
      matchedFields.add("researchArea");
      addEvidenceMatch(
        matchingEvidence,
        "researchArea",
        area,
        origin,
        matchedTerm,
      );
    }
  }

  const normalizedSummary = normalizeSearchText(group.summary);
  let summaryMatched = false;

  if (normalizedSummary === normalizedQuery) {
    score += 60;
    summaryMatched = true;
  } else if (normalizedSummary.includes(normalizedQuery)) {
    score += 28;
    summaryMatched = true;
  }

  for (const token of tokens) {
    if (normalizedSummary.includes(token)) {
      score += 4;
      summaryMatched = true;
    }
  }

  if (summaryMatched) {
    matchedFields.add("summary");
    addEvidenceMatch(
      matchingEvidence,
      "summary",
      group.summary,
      origin,
      matchedTerm,
    );
  }

  return {
    group,
    score,
    matchedFieldCount: matchedFields.size,
    exactNameMatch,
    matchingEvidence: finalizeEvidenceMatches(matchingEvidence),
  };
}

function buildReason(
  group: ResearchGroup,
  exactNameMatch: boolean,
  matches: ResearchGroupEvidenceMatchPayload[],
): string {
  if (exactNameMatch) {
    return "The research group name is an exact match for your search.";
  }

  const matchedAreas = matches.filter(
    (match) => match.category === "researchArea",
  );
  if (matchedAreas.length > 0) {
    const areaText = matchedAreas
      .slice(0, 2)
      .map(({ value }) => value)
      .join(" and ");
    return `The group's curated focus areas include ${areaText}, matching your search.`;
  }

  if (matches.some((match) => match.category === "name")) {
    return "The research group name contains terms from your search.";
  }

  return `The ${group.name} summary contains terms that match your search.`;
}

export function rankResearchGroups(
  groups: ResearchGroup[],
  query: string,
  interpretedTerms: string[] = [],
  memberCounts: Map<string, number> = new Map(),
): ResearchGroupSearchResultPayload[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  return groups
    .map((group) => {
      const rawRank = rankResearchGroupTerm(
        group,
        normalizedQuery,
        getQueryTokens(normalizedQuery),
        "query",
        query,
      );
      const evidenceGroups = [rawRank.matchingEvidence];
      let expandedScore = 0;
      let expandedFieldCount = 0;

      for (const term of interpretedTerms) {
        const normalizedTerm = normalizeSearchText(term);
        const expandedRank = rankResearchGroupTerm(
          group,
          normalizedTerm,
          getQueryTokens(normalizedTerm),
          "interpreted",
          term,
        );
        expandedScore += expandedRank.score;
        expandedFieldCount += expandedRank.matchedFieldCount;
        evidenceGroups.push(expandedRank.matchingEvidence);
      }

      const matchingEvidence = mergeEvidenceMatches(...evidenceGroups);

      return {
        group,
        score: rawRank.score + 0.35 * expandedScore,
        matchedFieldCount: rawRank.matchedFieldCount + expandedFieldCount,
        exactNameMatch: rawRank.exactNameMatch,
        matchingEvidence,
      };
    })
    .filter((ranked) => ranked.score > 0)
    .sort(
      (left, right) =>
        Number(right.exactNameMatch) - Number(left.exactNameMatch) ||
        right.score - left.score ||
        right.matchedFieldCount - left.matchedFieldCount ||
        left.group.name.localeCompare(right.group.name),
    )
    .slice(0, RESEARCH_GROUP_RESULT_LIMIT)
    .map(({ group, exactNameMatch, matchingEvidence }) => ({
      id: group.id,
      slug: group.slug,
      name: group.name,
      summary: group.summary,
      researchAreas: group.researchAreas,
      memberCount: memberCounts.get(group.id) ?? 0,
      reason: buildReason(group, exactNameMatch, matchingEvidence),
      evidence: { matches: matchingEvidence },
    }));
}
