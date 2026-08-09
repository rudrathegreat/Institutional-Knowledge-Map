export interface SearchEvidencePayload {
  biography: string;
  methods: string[];
  instruments: string[];
  software: string[];
  keywords: string[];
}

export interface SearchResultPayload {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
  reason: string;
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
