# Institutional Expertise Navigator — Minimal MVP Requirements

## 1. Scope

The MVP contains one user workflow:

> **Enter a query and receive relevant people with concise, grounded explanations.**

There are no secondary pages or major product features.

---

# 2. Functional Requirements

## FR-001 — Search Bar

The application must provide one primary search input.

It must accept:

- researcher names;
- topics;
- methods;
- instruments;
- software;
- natural-language questions.

### Acceptance tests

- An exact seeded researcher name can be submitted.
- A seeded topic can be submitted.
- A multi-sentence natural-language question can be submitted.
- Empty queries are rejected.
- Search can be triggered by keyboard and pointer interaction.

---

## FR-002 — Exact and Lexical Search

The application must perform lexical retrieval against stored researcher fields.

Searchable fields must include:

- name;
- title;
- role;
- biography;
- research areas;
- methods;
- instruments;
- software;
- keywords.

### Acceptance tests

- Searching an exact researcher name returns that researcher first.
- Searching a stored instrument returns associated researchers.
- Searching a stored method returns associated researchers.
- Lexical search works without a generative model call.

---

## FR-003 — Semantic Search

The application must support semantic retrieval.

Each researcher must have a stored embedding derived from their searchable profile representation.

A user query must be embeddable and compared with researcher embeddings.

### Acceptance tests

- A natural-language query with limited exact keyword overlap can still retrieve a semantically relevant researcher.
- Similarity is calculated without a dedicated vector database.
- Semantic search uses stored researcher embeddings rather than regenerating all researcher embeddings per request.

---

## FR-004 — Hybrid Ranking

The application must combine lexical and semantic evidence.

Exact researcher-name matches must receive stronger priority than semantic matches.

### Acceptance tests

- Exact full-name searches return the intended person first.
- A conceptually relevant profile can appear even when exact wording differs.
- Numerical ranking values are not shown to users as expertise scores.

---

## FR-005 — Search Results

The response must display a small ranked list of relevant people.

Each result must include at minimum:

- name;
- title or role;
- relevant research areas or expertise;
- concise relevance explanation when available.

### Acceptance tests

- Every displayed result corresponds to a valid database record.
- No AI-generated researcher identity can be rendered.
- Results remain usable when explanation generation is unavailable.

---

## FR-006 — AI Relevance Explanation

The system may send retrieved candidate researchers to the LLM.

The LLM must return structured output containing:

- researcher ID;
- concise relevance reason;
- optional interpreted query topics.

### Acceptance tests

- The LLM can only reference candidate researcher IDs supplied by the server.
- Returned IDs are validated before display.
- Explanations must be based on stored researcher evidence.
- Invalid model output is handled without crashing the search flow.

---

## FR-007 — No Scientific Answer Generation

The system must not answer the substantive scientific or technical question.

### Acceptance test

Given:

```text
Why does scintillation change pulsar brightness?
```

the application returns people relevant to pulsars/scintillation and does not provide a tutorial or scientific explanation as the primary response.

---

## FR-008 — Mock Researcher Dataset

The repository must include approximately 25–40 fictional researchers/staff.

The data should contain:

- multiple roles;
- overlapping research topics;
- overlapping methods;
- different instruments/software;
- multiple plausible matches for some queries.

### Acceptance tests

- The development database can be seeded from repository-controlled data.
- At least five prepared test queries return more than one plausible researcher.
- Re-seeding produces a predictable development dataset.

---

## FR-009 — Database Seeding

The repository must support:

```bash
npm run db:seed
```

The command must create or refresh the local SQLite database from mock data.

### Acceptance tests

- A fresh checkout can seed the database successfully.
- Seeded researchers have all fields required by search.
- Stored researcher embeddings are available after seeding.

---

## FR-010 — Graceful AI Failure

Search must degrade gracefully.

### Acceptance tests

- If the explanation model fails, retrieved people are still shown.
- If semantic embedding generation fails, lexical search is attempted.
- AI provider failure does not crash the application.

---

# 3. Performance Requirements

## PR-001 — Initial Page

The search interface should become usable within 2 seconds under normal local or production conditions.

---

## PR-002 — Lexical Search

For up to 500 researchers:

- local/server lexical retrieval should target <100 ms excluding network transport.

---

## PR-003 — Semantic Similarity

For up to 500 stored embeddings:

- similarity computation should target <100 ms after the query embedding has been obtained.

---

## PR-004 — Search Without LLM Explanation

Under normal embedding API conditions:

- semantic search results should target <2 seconds end-to-end.

---

## PR-005 — Search With LLM Explanation

Under normal model API conditions:

- search plus generated explanation should target <5 seconds.

The UI should display a controlled loading state while waiting.

---

## PR-006 — Scale Target

The same architecture should remain functional for at least 500 researcher records without requiring a vector database or architectural redesign.

This is not a university-scale production requirement.

---

# 4. Reliability Requirements

## RR-001 — No Phantom People

Researcher identities must originate only from the database.

The LLM cannot create a new researcher.

---

## RR-002 — Deterministic Seed Data

The development dataset must be repository controlled.

Search behaviour should be reproducible enough for automated tests and demos.

---

## RR-003 — AI Independence

Core lexical search must continue to function if all generative AI calls are disabled.

---

## RR-004 — Controlled Errors

Search API errors must return structured error responses rather than unhandled exceptions.

---

# 5. Security Requirements

## SR-001 — API Keys

AI and embedding API keys must:

- remain server-side;
- use environment variables;
- never be committed;
- never be sent to the browser.

---

## SR-002 — Database Access

SQLite access must occur server-side only.

The browser must not receive database credentials or direct filesystem access.

---

## SR-003 — LLM Isolation

The LLM must not receive:

- database credentials;
- arbitrary SQL capability;
- unrestricted database access;
- arbitrary application tools.

It receives only the user query and selected candidate records.

---

## SR-004 — Input Validation

The search endpoint must validate input.

Requirements:

- non-empty query;
- string type;
- maximum query length;
- malformed JSON returns 4xx.

Recommended maximum query length:

```text
2,000 characters
```

---

## SR-005 — Output Validation

LLM structured output must be schema validated.

Any returned researcher ID that is not in the supplied candidate set must be discarded.

---

## SR-006 — SQL Injection Prevention

All database access must use parameterised ORM/query-builder operations.

Do not concatenate user input into raw SQL.

---

## SR-007 — XSS Prevention

All researcher data and AI-generated text must be rendered safely.

Do not inject unsanitised HTML.

---

## SR-008 — Basic Rate Limiting

The deployed AI-backed search endpoint should have lightweight abuse protection.

A simple per-IP or platform-provided rate limit is sufficient for the MVP.

---

## SR-009 — Data Scope

The MVP must use mock researcher data only.

Do not store:

- student personal data;
- private university records;
- credentials;
- internal staff information.

---

## SR-010 — Logging

Do not log secrets or API credentials.

Persistent storage of user search queries is not required for the MVP.

---

# 6. AI Grounding Requirements

## AR-001 — Retrieval Before Generation

The server must retrieve candidates before invoking the explanation model.

---

## AR-002 — Candidate-Constrained Generation

The model may only discuss supplied researcher candidates.

---

## AR-003 — Evidence-Constrained Explanation

The model must base explanations only on stored researcher profile fields.

If evidence is weak, the explanation should indicate uncertainty.

---

## AR-004 — Short Responses

Each relevance explanation should normally be one or two sentences.

The application must not create long conversational responses.

---

## AR-005 — Avoid Ranking Language

Do not use labels such as:

- best scientist;
- most qualified;
- expertise score;
- top researcher.

Preferred language:

- relevant to this query;
- may be useful to approach;
- relevant experience;
- also relevant.

---

# 7. UX Requirements

## UX-001 — Search Is the Interface

The search bar must be the dominant interface element.

There must be no dashboard, sidebar, feed, profile browser, or other competing workflow.

---

## UX-002 — Non-Chat Experience

Do not render:

- user message bubbles;
- assistant message bubbles;
- conversation history;
- typing indicators;
- AI avatars.

A search produces search results.

---

## UX-003 — Concise Results

Each result should be quick to scan.

Prioritise:

1. name;
2. role/title;
3. relevant expertise;
4. why they may be relevant.

---

## UX-004 — Loading State

Use a simple search loading state such as:

```text
Searching expertise…
```

Do not simulate conversational typing.

---

## UX-005 — Empty State

If no useful matches are found:

```text
No strong matches found.

Try a broader topic, method, instrument, or describe the problem
in different words.
```

---

# 8. Explicit Non-Requirements

Do not implement:

- people directory;
- profile pages;
- raw profile browsing;
- researcher map;
- relationship graph;
- filters;
- dashboards;
- authentication;
- user accounts;
- ingestion;
- scraping;
- MCP;
- model function calling;
- vector database;
- graph database;
- RAG chatbot;
- scientific Q&A;
- agents;
- messaging;
- email;
- scheduling;
- analytics.

---

# 9. Minimum Automated Test Suite

The repository should test:

1. exact researcher name retrieval;
2. topic retrieval;
3. method/instrument retrieval;
4. semantic similarity utility;
5. hybrid ranking;
6. seed operation;
7. empty query rejection;
8. oversized query rejection;
9. AI explanation failure fallback;
10. invalid model researcher ID rejection;
11. structured model output validation;
12. search results contain only database researchers.

---

# 10. Definition of Done

A new developer should be able to run:

```bash
npm install
npm run db:seed
npm run dev
```

and demonstrate:

1. exact-name search;
2. topic/method/instrument search;
3. natural-language semantic search;
4. ranked researcher results;
5. short grounded AI explanations;
6. graceful fallback when AI explanation generation fails.

The MVP is not complete if additional product features have displaced effort from this core flow.
