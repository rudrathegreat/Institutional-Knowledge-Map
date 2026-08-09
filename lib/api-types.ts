export interface SearchResultPayload {
  id: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
  reason: string;
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
