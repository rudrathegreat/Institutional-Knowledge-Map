export interface PublicationEvidencePayload {
  id: string;
  title: string;
  workType: string;
  publicationDate: string;
  dataSource: "mock" | "orcid";
}

export interface SearchEvidencePayload {
  biography: string;
  methods: string[];
  instruments: string[];
  software: string[];
  keywords: string[];
  publications: PublicationEvidencePayload[];
}

export interface SearchResultPayload {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
  reason: string;
  isSuggestedContact?: boolean;
  evidence: SearchEvidencePayload;
}

export interface SearchResponsePayload {
  interpretedTopics: string[];
  results: SearchResultPayload[];
}

export interface SearchErrorPayload {
  error: {
    code: string;
    message: string;
  };
}
