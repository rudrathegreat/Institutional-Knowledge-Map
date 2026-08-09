# Institutional Expertise Navigator — Minimal MVP Requirements

## 1. Scope

The product contains two complementary user workflows:

> **Enter a query and receive relevant people with concise, grounded explanations.**

> **Browse all people and open a detailed profile grounded in stored researcher data.**

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

## FR-003 — Puter-Assisted Natural-Language Search

The browser may ask Puter to interpret an ordinary-language query into terms selected from a server-derived expertise vocabulary. The model must be explicitly configured as `google/gemini-3.1-flash-lite` with temperature zero.

The vocabulary must be derived from stored titles, roles, research areas, methods, instruments, software, and keywords. Proposed terms must be validated in both browser and server trust boundaries.

### Acceptance tests

- A natural-language query with limited exact keyword overlap can still retrieve a relevant researcher through controlled expansion.
- Unknown and duplicate terms are discarded.
- Malformed or non-JSON Puter output is not submitted as interpreted terms.
- Search continues with the raw query when Puter is unavailable.

---

## FR-004 — Hybrid Ranking

The application must combine raw-query lexical evidence with validated expanded-term evidence.

Exact researcher-name matches must always precede expansion matches. Expanded-term scores contribute at `0.35 ×` their accumulated lexical score.

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

The browser may send retrieved candidate researchers to Puter.

Puter must return structured JSON containing:

- researcher ID;
- concise relevance reason;
- interpreted query topics are produced by the separate pre-retrieval interpretation call and remain in browser state.

### Acceptance tests

- Puter can only reference candidate researcher IDs supplied by the server.
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
- All 30 fictional biographies are unique, contain three detailed sentences, and are at least 250 characters.
- The compatibility embedding column remains `null` after seeding.

---

## FR-010 — Graceful AI Failure

Search must degrade gracefully.

### Acceptance tests

- If the explanation model fails, retrieved people are still shown.
- If Puter query interpretation fails, raw lexical search is attempted.
- If Puter explanation generation fails, deterministic reasons remain visible.
- Cancelling Puter authentication, exhausting allowance, or selecting an unavailable model does not crash search.
- AI provider failure does not crash the application.

---

## FR-011 — People Directory

The application must provide an alphabetical directory containing every stored researcher. Each entry must show the person's name, title, role, and research areas and link to their profile.

### Acceptance tests

- The directory contains all seeded researchers exactly once.
- People are ordered alphabetically by their stored display name.
- Every directory entry links to a valid person profile.

---

## FR-012 — Person Profiles

Every researcher must have a stable, human-readable profile URL. Profiles must show the stored title, role, biography, research areas, methods, instruments, software, and keywords. Search-result names must link to the same profiles.

### Acceptance tests

- Valid slugs resolve to the matching database researcher.
- Unknown slugs return a controlled 404 page.
- Profile metadata identifies the person.
- Slugs remain unique and deterministic across reseeding.

---

# 3. Performance Requirements

## PR-001 — Initial Page

The search interface should become usable within 2 seconds under normal local or production conditions.

---

## PR-002 — Lexical Search

For up to 500 researchers:

- local/server lexical retrieval should target <100 ms excluding network transport.

---

## PR-003 — Expanded-Term Ranking

For up to 500 researcher records, server-side validation and expanded-term ranking should target <100 ms excluding network transport.

---

## PR-004 — Search Without LLM Explanation

Without a successful Puter call, lexical search results should target <2 seconds end-to-end.

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

## SR-001 — Puter User-Pays Access

The application must not store or proxy an AI-provider key. Puter website authentication and usage are associated with the user's Puter account under the user-pays model.

`NEXT_PUBLIC_PUTER_AI_MODEL` is public configuration, not a secret. OpenAI-prefixed values must disable AI assistance rather than falling back to Puter's default model.

---

## SR-002 — Database Access

SQLite access must occur server-side only.

The browser must not receive database credentials or direct filesystem access.

---

## SR-003 — LLM Isolation

Puter must not receive:

- database credentials;
- arbitrary SQL capability;
- unrestricted database access;
- arbitrary application tools.

The interpretation call receives only the query and controlled vocabulary. The explanation call receives only the query and up to five selected candidate records.

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

Puter structured output must be schema validated with Zod after `JSON.parse`.

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

The SQLite search endpoint must enforce a process-local limit of 20 searches per IP per 60 seconds and return HTTP 429 with `Retry-After` when exceeded.

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

## AR-001 — Controlled Interpretation Before Retrieval

Puter may select query-expansion terms only from the supplied vocabulary. The server must validate those terms and retrieve candidates before the browser invokes the explanation call.

---

## AR-002 — Candidate-Constrained Generation

The explanation call may only discuss supplied researcher candidates.

---

## AR-003 — Evidence-Constrained Explanation

Puter must base explanations only on stored researcher profile fields.

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

## UX-001 — Search Is the Primary Interface

The search bar must be the dominant interface element.

The people directory and profiles must remain visually secondary to the focused search workflow. Do not introduce dashboards, sidebars, or feeds.

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

- related-people recommendations;
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
4. expertise-vocabulary generation and validation;
5. raw-plus-expanded ranking and exact-name precedence;
6. seed operation;
7. empty query rejection;
8. oversized query rejection;
9. Puter interpretation and explanation failure fallbacks;
10. unknown and duplicate model term/ID rejection;
11. strict and fenced JSON model output validation;
12. search results contain only database researchers;
13. evidence payloads and the 20-per-minute IP rate limit;
14. browser interpretation, topic, notice, and explanation rendering.

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
3. natural-language controlled query expansion;
4. ranked researcher results;
5. short grounded AI explanations;
6. graceful raw-lexical and deterministic-reason fallback when Puter fails;
7. an alphabetical directory containing every researcher;
8. stable profile links from both the directory and search results;
9. a complete stored-data profile for every researcher.

The MVP is not complete if additional product features have displaced effort from this core flow.
