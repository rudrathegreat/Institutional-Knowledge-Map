import type { OrcidWork, Researcher } from "@/db/schema";
import { orcidWorks, researchers } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import type {
  PublicationEvidencePayload,
  ResearchGroupSummary,
  SearchEvidenceCategory,
  SearchEvidenceMatchPayload,
  SearchEvidenceOrigin,
} from "@/lib/api-types";
import { normalizeSearchText } from "@/lib/search-text";
import { attachResearchGroups } from "@/lib/research-groups";

export { normalizeSearchText } from "@/lib/search-text";

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
export const MAX_INTERPRETED_TERMS = 12;
export const MAX_INTERPRETED_TERM_LENGTH = 100;
export const EXPANDED_TERM_WEIGHT = 0.35;
export const RESULT_LIMIT = 5;
export const MAX_PUBLICATION_SCORE = 45;

export interface SearchEvidence {
  biography: string;
  methods: string[];
  instruments: string[];
  software: string[];
  keywords: string[];
  publications: Array<
    Pick<
      OrcidWork,
      "id" | "title" | "workType" | "publicationDate" | "dataSource"
    >
  >;
  matches: SearchEvidenceMatchPayload[];
}

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchGroups: ResearchGroupSummary[];
  researchAreas: string[];
  reason: string;
  evidence: SearchEvidence;
}

type SearchableResearcher = Researcher & {
  researchGroups?: ResearchGroupSummary[];
};

interface RankedResearcher {
  researcher: SearchableResearcher;
  score: number;
  matchedFieldCount: number;
  matchedEvidence: string[];
  matchedResearchGroups: string[];
  exactResearchGroupMatch: boolean;
  matchedPublications: OrcidWork[];
  rawProfileScore: number;
  publicationScore: number;
  exactNameMatch: boolean;
  matchingEvidence: SearchEvidenceMatchPayload[];
}

interface RankedPublications {
  score: number;
  matches: OrcidWork[];
}

interface MutableEvidenceMatch {
  category: SearchEvidenceCategory;
  value: string;
  origins: Set<SearchEvidenceOrigin>;
  matchedTerms: Map<string, string>;
  publication?: PublicationEvidencePayload;
}

function getQueryTokens(normalizedQuery: string): string[] {
  const allTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const meaningfulTokens = allTokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token),
  );

  return meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;
}

function toPublicationEvidence(publication: OrcidWork): PublicationEvidencePayload {
  const { id, title, workType, publicationDate, dataSource } = publication;

  return { id, title, workType, publicationDate, dataSource };
}

function addEvidenceMatch(
  matches: Map<string, MutableEvidenceMatch>,
  category: SearchEvidenceCategory,
  value: string,
  origin: SearchEvidenceOrigin,
  matchedTerm: string,
  publication?: PublicationEvidencePayload,
): void {
  const key = `${category}:${publication?.id ?? normalizeSearchText(value)}`;
  const currentMatch = matches.get(key) ?? {
    category,
    value,
    origins: new Set<SearchEvidenceOrigin>(),
    matchedTerms: new Map<string, string>(),
    publication,
  };
  const normalizedTerm = normalizeSearchText(matchedTerm);

  currentMatch.origins.add(origin);
  if (normalizedTerm && !currentMatch.matchedTerms.has(normalizedTerm)) {
    currentMatch.matchedTerms.set(normalizedTerm, matchedTerm.trim());
  }
  matches.set(key, currentMatch);
}

function finalizeEvidenceMatches(
  matches: Map<string, MutableEvidenceMatch>,
): SearchEvidenceMatchPayload[] {
  return [...matches.values()].map((match) => ({
    category: match.category,
    value: match.value,
    origins: [...match.origins],
    matchedTerms: [...match.matchedTerms.values()],
    ...(match.publication ? { publication: match.publication } : {}),
  }));
}

function mergeEvidenceMatches(
  ...groups: SearchEvidenceMatchPayload[][]
): SearchEvidenceMatchPayload[] {
  const merged = new Map<string, MutableEvidenceMatch>();

  for (const match of groups.flat()) {
    for (const origin of match.origins) {
      for (const term of match.matchedTerms) {
        addEvidenceMatch(
          merged,
          match.category,
          match.value,
          origin,
          term,
          match.publication,
        );
      }
    }
  }

  return finalizeEvidenceMatches(merged);
}

function getBiographyExcerpts(
  biography: string,
  normalizedQuery: string,
  tokens: string[],
): string[] {
  const sentences = biography.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [biography];
  const needles = [normalizedQuery, ...tokens].filter(Boolean);
  const excerpts = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const normalizedSentence = normalizeSearchText(sentence);
      return needles.some((needle) => normalizedSentence.includes(needle));
    });

  return excerpts.length > 0 ? excerpts : [biography];
}

function rankResearcher(
  researcher: SearchableResearcher,
  normalizedQuery: string,
  tokens: string[],
  origin: SearchEvidenceOrigin,
  matchedTerm: string,
): RankedResearcher {
  let score = 0;
  const matchedFields = new Set<string>();
  const matchedEvidence = new Map<string, string>();
  const matchingEvidence = new Map<string, MutableEvidenceMatch>();
  const matchedResearchGroups = new Map<string, string>();
  const normalizedName = normalizeSearchText(researcher.name);
  const exactNameMatch = normalizedName === normalizedQuery;
  let exactResearchGroupMatch = false;
  let nameMatched = false;

  if (exactNameMatch) {
    score += 1_000;
    matchedFields.add("name");
    nameMatched = true;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 160;
    matchedFields.add("name");
    nameMatched = true;
  }

  for (const token of tokens) {
    if (normalizedName.includes(token)) {
      score += 30;
      matchedFields.add("name");
      nameMatched = true;
    }
  }

  if (nameMatched) {
    addEvidenceMatch(
      matchingEvidence,
      "name",
      researcher.name,
      origin,
      matchedTerm,
    );
  }

  if (origin === "query") {
    for (const group of researcher.researchGroups ?? []) {
      const normalizedGroupName = normalizeSearchText(group.name);
      let groupMatched = false;

      if (normalizedGroupName === normalizedQuery) {
        score += 80;
        groupMatched = true;
        exactResearchGroupMatch = true;
      } else if (normalizedGroupName.includes(normalizedQuery)) {
        score += 50;
        groupMatched = true;
      }

      for (const token of tokens) {
        if (normalizedGroupName.includes(token)) {
          score += 8;
          groupMatched = true;
        }
      }

      if (groupMatched) {
        matchedFields.add("research groups");
        matchedResearchGroups.set(normalizedGroupName, group.name);
        addEvidenceMatch(
          matchingEvidence,
          "researchGroup",
          group.name,
          origin,
          matchedTerm,
        );
      }
    }
  }

  const structuredFields: Array<
    [string, SearchEvidenceCategory, string[]]
  > = [
    ["research areas", "researchArea", researcher.researchAreas],
    ["methods", "method", researcher.methods],
    ["instruments", "instrument", researcher.instruments],
    ["software", "software", researcher.software],
    ["keywords", "keyword", researcher.keywords],
  ];

  for (const [fieldName, category, values] of structuredFields) {
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
        addEvidenceMatch(
          matchingEvidence,
          category,
          value,
          origin,
          matchedTerm,
        );
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
      addEvidenceMatch(
        matchingEvidence,
        fieldName as "title" | "role",
        value,
        origin,
        matchedTerm,
      );
    }
  }

  const normalizedBiography = normalizeSearchText(researcher.biography);
  let biographyMatched = false;

  if (normalizedBiography.includes(normalizedQuery)) {
    score += 16;
    biographyMatched = true;
  }

  for (const token of tokens) {
    if (normalizedBiography.includes(token)) {
      score += 3;
      biographyMatched = true;
    }
  }

  if (biographyMatched) {
    matchedFields.add("biography");
    for (const excerpt of getBiographyExcerpts(
      researcher.biography,
      normalizedQuery,
      tokens,
    )) {
      addEvidenceMatch(
        matchingEvidence,
        "biography",
        excerpt,
        origin,
        matchedTerm,
      );
    }
  }

  return {
    researcher,
    score,
    matchedFieldCount: matchedFields.size,
    matchedEvidence: [...matchedEvidence.values()],
    matchedResearchGroups: [...matchedResearchGroups.values()],
    exactResearchGroupMatch,
    matchedPublications: [],
    rawProfileScore: score,
    publicationScore: 0,
    exactNameMatch,
    matchingEvidence: finalizeEvidenceMatches(matchingEvidence),
  };
}

export function scorePublicationEvidence(
  publications: OrcidWork[],
  normalizedQuery: string,
  tokens: string[],
): RankedPublications {
  const rankedMatches = publications
    .map((publication) => {
      const normalizedTitle = normalizeSearchText(publication.title);
      let score = 0;

      if (normalizedTitle === normalizedQuery) {
        score += 45;
      } else if (normalizedTitle.includes(normalizedQuery)) {
        score += 30;
      }

      for (const token of tokens) {
        if (normalizedTitle.includes(token)) {
          score += 3;
        }
      }

      return { publication, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.publication.publicationDate.localeCompare(
          left.publication.publicationDate,
        ) ||
        left.publication.title.localeCompare(right.publication.title),
    );

  return {
    score: Math.min(
      MAX_PUBLICATION_SCORE,
      rankedMatches.reduce((total, { score }) => total + score, 0),
    ),
    matches: rankedMatches.map(({ publication }) => publication),
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

  if (
    ranked.exactResearchGroupMatch &&
    ranked.matchedResearchGroups.length > 0
  ) {
    return `They are listed in the ${ranked.matchedResearchGroups[0]} research group, matching your search.`;
  }

  if (
    ranked.matchedPublications.length > 0 &&
    ranked.publicationScore >= ranked.rawProfileScore
  ) {
    return `A recent listed demo publication, “${ranked.matchedPublications[0].title}”, matches your search.`;
  }

  if (ranked.matchedEvidence.length > 0) {
    return `Their stored profile includes ${formatEvidence(
      ranked.matchedEvidence.slice(0, 2),
    )}, matching your search.`;
  }

  if (ranked.matchedResearchGroups.length > 0) {
    return `They are listed in the ${ranked.matchedResearchGroups[0]} research group, matching your search.`;
  }

  return "Their stored profile contains terms that match your search.";
}

function getVocabularyValues(researcher: Researcher): string[] {
  return [
    researcher.title,
    researcher.role,
    ...researcher.researchAreas,
    ...researcher.methods,
    ...researcher.instruments,
    ...researcher.software,
    ...researcher.keywords,
  ];
}

export function buildExpertiseVocabulary(records: SearchableResearcher[]): string[] {
  const valuesByNormalizedTerm = new Map<string, string>();

  for (const researcher of records) {
    for (const value of getVocabularyValues(researcher)) {
      const trimmedValue = value.trim();
      const normalizedValue = normalizeSearchText(trimmedValue);

      if (normalizedValue && !valuesByNormalizedTerm.has(normalizedValue)) {
        valuesByNormalizedTerm.set(normalizedValue, trimmedValue);
      }
    }
  }

  return [...valuesByNormalizedTerm.values()].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function validateInterpretedTerms(
  records: SearchableResearcher[],
  terms: string[],
): string[] {
  const vocabulary = new Map(
    buildExpertiseVocabulary(records).map((term) => [normalizeSearchText(term), term]),
  );
  const validTerms = new Map<string, string>();

  for (const term of terms.slice(0, MAX_INTERPRETED_TERMS)) {
    const normalizedTerm = normalizeSearchText(term);
    const vocabularyTerm = vocabulary.get(normalizedTerm);

    if (vocabularyTerm && !validTerms.has(normalizedTerm)) {
      validTerms.set(normalizedTerm, vocabularyTerm);
    }
  }

  return [...validTerms.values()];
}

export function rankResearchers(
  records: SearchableResearcher[],
  query: string,
  interpretedTerms: string[] = [],
  publications: OrcidWork[] = [],
): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const validInterpretedTerms = validateInterpretedTerms(records, interpretedTerms);
  const queryTokens = getQueryTokens(normalizedQuery);
  const publicationsByResearcherId = new Map<string, OrcidWork[]>();

  for (const publication of publications) {
    const researcherPublications =
      publicationsByResearcherId.get(publication.researcherId) ?? [];
    researcherPublications.push(publication);
    publicationsByResearcherId.set(publication.researcherId, researcherPublications);
  }

  for (const researcherPublications of publicationsByResearcherId.values()) {
    researcherPublications.sort(
      (left, right) =>
        right.publicationDate.localeCompare(left.publicationDate) ||
        left.title.localeCompare(right.title),
    );
  }

  return records
    .map((researcher) => {
      const rawRank = rankResearcher(
        researcher,
        normalizedQuery,
        queryTokens,
        "query",
        query,
      );
      const researcherPublications =
        publicationsByResearcherId.get(researcher.id) ?? [];
      const publicationRank = scorePublicationEvidence(
        researcherPublications,
        normalizedQuery,
        queryTokens,
      );
      const matchedEvidence = new Map(
        rawRank.matchedEvidence.map((value) => [normalizeSearchText(value), value]),
      );
      const matchingEvidenceGroups = [rawRank.matchingEvidence];
      let expandedScore = 0;
      let expandedFieldCount = 0;

      for (const term of validInterpretedTerms) {
        const normalizedTerm = normalizeSearchText(term);
        const expandedRank = rankResearcher(
          researcher,
          normalizedTerm,
          getQueryTokens(normalizedTerm),
          "interpreted",
          term,
        );
        expandedScore += expandedRank.score;
        expandedFieldCount += expandedRank.matchedFieldCount;

        for (const value of expandedRank.matchedEvidence) {
          matchedEvidence.set(normalizeSearchText(value), value);
        }
        matchingEvidenceGroups.push(expandedRank.matchingEvidence);
      }

      const publicationEvidence = publicationRank.matches.map((publication) => ({
        category: "publication" as const,
        value: publication.title,
        origins: ["query" as const],
        matchedTerms: [query.trim()],
        publication: toPublicationEvidence(publication),
      }));

      return {
        ...rawRank,
        score:
          rawRank.score +
          publicationRank.score +
          EXPANDED_TERM_WEIGHT * expandedScore,
        matchedFieldCount:
          rawRank.matchedFieldCount +
          expandedFieldCount +
          Number(publicationRank.matches.length > 0),
        matchedEvidence: [...matchedEvidence.values()],
        matchedResearchGroups: rawRank.matchedResearchGroups,
        exactResearchGroupMatch: rawRank.exactResearchGroupMatch,
        matchedPublications: publicationRank.matches,
        publicationScore: publicationRank.score,
        matchingEvidence: mergeEvidenceMatches(
          ...matchingEvidenceGroups,
          publicationEvidence,
        ),
      };
    })
    .filter((ranked) => ranked.score > 0)
    .sort(
      (left, right) =>
        Number(right.exactNameMatch) - Number(left.exactNameMatch) ||
        right.score - left.score ||
        right.matchedFieldCount - left.matchedFieldCount ||
        left.researcher.name.localeCompare(right.researcher.name),
    )
    .slice(0, RESULT_LIMIT)
    .map((ranked) => ({
      id: ranked.researcher.id,
      slug: ranked.researcher.slug,
      name: ranked.researcher.name,
      title: ranked.researcher.title,
      role: ranked.researcher.role,
      researchGroups: ranked.researcher.researchGroups ?? [],
      researchAreas: ranked.researcher.researchAreas,
      reason: buildReason(ranked),
      evidence: {
        biography: ranked.researcher.biography,
        methods: ranked.researcher.methods,
        instruments: ranked.researcher.instruments,
        software: ranked.researcher.software,
        keywords: ranked.researcher.keywords,
        publications: (publicationsByResearcherId.get(ranked.researcher.id) ?? [])
          .slice(0, 3)
          .map(toPublicationEvidence),
        matches: ranked.matchingEvidence,
      },
    }));
}

export function getExpertiseVocabulary(): string[] {
  const records = getDatabase().select().from(researchers).all();
  return buildExpertiseVocabulary(records);
}

export function searchResearchers(
  query: string,
  interpretedTerms: string[] = [],
): SearchResult[] {
  return searchResearchersWithContext(query, interpretedTerms).results;
}

export function searchResearchersWithContext(
  query: string,
  interpretedTerms: string[] = [],
): { results: SearchResult[]; validInterpretedTerms: string[] } {
  const db = getDatabase();
  const records = attachResearchGroups(db.select().from(researchers).all());
  const publications = db.select().from(orcidWorks).all();
  const validInterpretedTerms = validateInterpretedTerms(
    records,
    interpretedTerms,
  );

  return {
    results: rankResearchers(records, query, validInterpretedTerms, publications),
    validInterpretedTerms,
  };
}
