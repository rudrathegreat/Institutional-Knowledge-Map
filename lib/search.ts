import type { Researcher } from "@/db/schema";
import { researchers } from "@/db/schema";
import { getDatabase } from "@/lib/db";

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

export const MAX_QUERY_LENGTH = 2_000;
export const RESULT_LIMIT = 5;

export interface SearchResult {
  id: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
  reason: string;
}

interface RankedResearcher {
  researcher: Researcher;
  score: number;
  matchedFieldCount: number;
  matchedEvidence: string[];
  exactNameMatch: boolean;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getQueryTokens(normalizedQuery: string): string[] {
  const allTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const meaningfulTokens = allTokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token),
  );

  return meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;
}

function containsToken(value: string, token: string): boolean {
  return normalizeSearchText(value).includes(token);
}

function rankResearcher(
  researcher: Researcher,
  normalizedQuery: string,
  tokens: string[],
): RankedResearcher {
  let score = 0;
  const matchedFields = new Set<string>();
  const matchedEvidence = new Map<string, string>();
  const normalizedName = normalizeSearchText(researcher.name);
  const exactNameMatch = normalizedName === normalizedQuery;

  if (exactNameMatch) {
    score += 1_000;
    matchedFields.add("name");
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 160;
    matchedFields.add("name");
  }

  for (const token of tokens) {
    if (normalizedName.includes(token)) {
      score += 30;
      matchedFields.add("name");
    }
  }

  const structuredFields: Array<[string, string[]]> = [
    ["research areas", researcher.researchAreas],
    ["methods", researcher.methods],
    ["instruments", researcher.instruments],
    ["software", researcher.software],
    ["keywords", researcher.keywords],
  ];

  for (const [fieldName, values] of structuredFields) {
    for (const value of values) {
      const normalizedValue = normalizeSearchText(value);
      let valueMatched = false;

      if (normalizedValue === normalizedQuery) {
        score += 120;
        valueMatched = true;
      } else if (normalizedValue.includes(normalizedQuery)) {
        score += 70;
        valueMatched = true;
      }

      for (const token of tokens) {
        if (normalizedValue.includes(token)) {
          score += 16;
          valueMatched = true;
        }
      }

      if (valueMatched) {
        matchedFields.add(fieldName);
        matchedEvidence.set(normalizedValue, value);
      }
    }
  }

  const identityFields: Array<[string, string]> = [
    ["title", researcher.title],
    ["role", researcher.role],
  ];

  for (const [fieldName, value] of identityFields) {
    const normalizedValue = normalizeSearchText(value);
    let valueMatched = false;

    if (normalizedValue.includes(normalizedQuery)) {
      score += 40;
      valueMatched = true;
    }

    for (const token of tokens) {
      if (normalizedValue.includes(token)) {
        score += 8;
        valueMatched = true;
      }
    }

    if (valueMatched) {
      matchedFields.add(fieldName);
    }
  }

  const normalizedBiography = normalizeSearchText(researcher.biography);
  let biographyMatched = false;

  if (normalizedBiography.includes(normalizedQuery)) {
    score += 16;
    biographyMatched = true;
  }

  for (const token of tokens) {
    if (containsToken(researcher.biography, token)) {
      score += 3;
      biographyMatched = true;
    }
  }

  if (biographyMatched) {
    matchedFields.add("biography");
  }

  return {
    researcher,
    score,
    matchedFieldCount: matchedFields.size,
    matchedEvidence: [...matchedEvidence.values()],
    exactNameMatch,
  };
}

function formatEvidence(values: string[]): string {
  if (values.length === 1) {
    return values[0];
  }

  return `${values[0]} and ${values[1]}`;
}

function buildReason(ranked: RankedResearcher): string {
  if (ranked.exactNameMatch) {
    return "Their name is an exact match for your search.";
  }

  if (ranked.matchedEvidence.length > 0) {
    return `Their stored profile includes ${formatEvidence(
      ranked.matchedEvidence.slice(0, 2),
    )}, matching your search.`;
  }

  return "Their stored profile contains terms that match your search.";
}

export function rankResearchers(
  records: Researcher[],
  query: string,
): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const tokens = getQueryTokens(normalizedQuery);

  return records
    .map((researcher) => rankResearcher(researcher, normalizedQuery, tokens))
    .filter((ranked) => ranked.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.matchedFieldCount - left.matchedFieldCount ||
        left.researcher.name.localeCompare(right.researcher.name),
    )
    .slice(0, RESULT_LIMIT)
    .map((ranked) => ({
      id: ranked.researcher.id,
      name: ranked.researcher.name,
      title: ranked.researcher.title,
      role: ranked.researcher.role,
      researchAreas: ranked.researcher.researchAreas,
      reason: buildReason(ranked),
    }));
}

export function searchResearchers(query: string): SearchResult[] {
  const records = getDatabase().select().from(researchers).all();
  return rankResearchers(records, query);
}
