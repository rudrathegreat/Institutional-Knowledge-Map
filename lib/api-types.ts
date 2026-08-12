export interface PublicationEvidencePayload {
  id: string;
  title: string;
  workType: string;
  publicationDate: string;
  dataSource: "mock" | "orcid";
}

export interface ResearchGroupSummary {
  id: string;
  slug: string;
  name: string;
  isPrimary: boolean;
}

export type ResearchGroupEvidenceCategory = "name" | "summary" | "researchArea";

export interface ResearchGroupEvidenceMatchPayload {
  category: ResearchGroupEvidenceCategory;
  value: string;
  origins: SearchEvidenceOrigin[];
  matchedTerms: string[];
}

export interface ResearchGroupSearchResultPayload {
  id: string;
  slug: string;
  name: string;
  summary: string;
  researchAreas: string[];
  memberCount: number;
  reason: string;
  evidence: {
    matches: ResearchGroupEvidenceMatchPayload[];
  };
}

export type SearchEvidenceOrigin = "query" | "interpreted";

export type SearchEvidenceCategory =
  | "name"
  | "title"
  | "role"
  | "researchGroup"
  | "researchArea"
  | "method"
  | "instrument"
  | "software"
  | "keyword"
  | "biography"
  | "publication";

export interface SearchEvidenceMatchPayload {
  category: SearchEvidenceCategory;
  value: string;
  origins: SearchEvidenceOrigin[];
  matchedTerms: string[];
  publication?: PublicationEvidencePayload;
}

export interface SearchEvidencePayload {
  biography: string;
  methods: string[];
  instruments: string[];
  software: string[];
  keywords: string[];
  publications: PublicationEvidencePayload[];
  matches: SearchEvidenceMatchPayload[];
}

export interface SearchResultPayload {
  recommendationId: string;
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchGroups: ResearchGroupSummary[];
  researchAreas: string[];
  reason: string;
  suggestedQuestion?: string;
  isSuggestedContact?: boolean;
  evidence: SearchEvidencePayload;
}

export interface SearchResponsePayload {
  interpretedTopics: string[];
  results: SearchResultPayload[];
  researchGroups: ResearchGroupSearchResultPayload[];
}

export interface SearchErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export type RecommendationFeedbackValue = "helpful" | "not_relevant";
export type RecommendationRankingMode = "deterministic" | "ai";

export interface RecommendationFeedbackResponsePayload {
  feedback: RecommendationFeedbackValue;
}
