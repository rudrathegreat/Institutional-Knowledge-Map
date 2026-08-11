# Institutional Expertise Navigator — Minimal MVP Architecture

## 1. Architectural Goal

The MVP backend should be as small and understandable as possible.

The system only needs to:

1. store mock researcher records;
2. accept a search query;
3. use browser-side AI to map ordinary language to controlled expertise terms;
4. rank matching researchers deterministically;
5. optionally ask Puter AI in the browser to re-rank and explain the retrieved candidates;
6. return the results.
7. list researchers for directory browsing;
8. return one researcher profile by stable slug;
9. derive a sparse, deterministic people network from structured profile fields.
10. collect anonymous, query-specific recommendation feedback without changing live ranking.

No ingestion system, MCP server, vector database, graph database, agent framework, or separate backend service is required.

---

## 2. High-Level Architecture

```text
                 MOCK RESEARCHER DATA
                          │
                          ▼
                     db:seed
                          │
                          ▼
                    SQLite database
                          │
                          ▼
                   Search service
                  /              \
                 /                \
        lexical retrieval    Puter term selection
                 \                /
                  \              /
                   merged ranking
                          │
                          ▼
                 candidate people
                          │
                          ▼
           optional Puter re-ranking
                          │
                          ▼
          validated order and reasons
                          │
                          ▼
                      response UI
```

---

## 3. Recommended Stack

Use one application repository.

Recommended stack:

- Next.js
- TypeScript
- React
- SQLite
- Drizzle ORM or similarly lightweight ORM
- `@heyputer/puter.js`, dynamically imported in the browser
- Cytoscape.js for the route-scoped interactive network renderer
- explicit `google/gemini-3.1-flash-lite` model selection

Do not create a separate backend application.

Do not create a Python service.

---

## 4. Minimal Repository Structure

```text
institutional-expertise-navigator/
│
├── app/
│   ├── page.tsx
│   ├── network/
│   │   └── page.tsx
│   └── api/
│       └── search/
│
├── components/
│   ├── SearchBar.tsx
│   ├── SearchResult.tsx
│   └── PeopleNetwork.tsx
│
├── lib/
│   ├── db.ts
│   ├── search.ts
│   ├── search-text.ts
│   ├── people-graph.ts
│   └── puter-ai.ts
│
├── data/
│   └── researchers.json
│
├── db/
│   ├── schema.ts
│   └── seed.ts
│
└── tests/
```

The secondary application surfaces are the people directory, database-backed person profiles, and the Network tab.

The Network page remains a server component for SQLite access. It derives serializable nodes and edges in-process, then passes them to a focused client component that owns Cytoscape lifecycle and interaction state. No graph API or graph database is introduced.

---

## 5. Database

Use SQLite.

The MVP stores curated researcher data plus repository-controlled mock ORCID works.

A simple schema is sufficient.

### `researchers`

Recommended fields:

```text
id
slug
orcid_id
orcid_id_status
name
title
role
biography
research_areas_json
methods_json
instruments_json
software_json
keywords_json
search_document
embedding_json
```

`embedding_json` remains nullable for schema compatibility and is deliberately unused. Seeded rows store `null`; this architecture does not generate or compare vectors.

### `orcid_works`

Mock publications are stored separately so one researcher can have multiple works and a future ORCID adapter can populate the same internal shape. Each row stores its researcher ID, title, work type, publication date, optional external identifier and URL, and data source. The current fixture always uses `mock` and supplies no external links.

### `recommendation_feedback`

Each returned result creates an anonymous recommendation context with opaque recommendation and search-group IDs, the researcher ID, validated interpreted terms, matched stored evidence values and categories, and its deterministic retrieval position. A feedback submission adds the displayed position, ranking mode, `helpful` or `not_relevant` value, and update time to that same row.

Raw queries, IP addresses, browser identifiers, and user identities are never stored. These records are retained for future offline ranking evaluation only; they do not affect live ranking and are not aggregated into researcher ratings. Researcher seeding uses ID-based upserts so feedback survives refreshes for identities that remain in the fixture.

---

## 6. Search Document

Each researcher has one normalised text representation used for deterministic lexical retrieval.

Example:

```text
Maya Chen.
Senior Research Fellow.
Research areas: pulsars, neutron stars, radio astronomy.
Methods: pulsar timing, time-series analysis.
Instruments: MeerKAT, Murriyang.
Software: Python, TEMPO2.
Biography: ...
```

The same structured fields also produce the controlled expertise vocabulary sent to the search client. Names and biography prose are not vocabulary entries.

Publication titles are not added to the controlled vocabulary or the stored search document. They are scored separately as capped, low-weight evidence.

---

## 7. Mock Data

The repository contains:

```text
data/researchers.json
data/orcid-records.json
```

Use approximately 25–40 fictional researchers with overlapping expertise. The ORCID fixture gives each of the 30 current people one clearly non-production mock iD and three fictional recent papers.

A seed command populates SQLite:

```bash
npm run db:seed
```

The seed process inserts researchers and mock works deterministically with `embedding_json` set to `null`. It validates complete person coverage and unique identifiers before inserting. Seeding performs no AI or network calls.

---

## 8. Search Architecture

The MVP uses deterministic lexical retrieval augmented by controlled query expansion.

```text
                       QUERY
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       raw lexical search      expanded-term search
             │                       │
 name / topic / fields        validated vocabulary terms
             │                       │
             ▼                       ▼
       lexical score          accumulated term score
             │                       │
             └───────────┬───────────┘
                         ▼
                   merged ranking
                         │
                         ▼
                    top results
```

---

## 9. Lexical Retrieval

Lexical retrieval should inspect:

- name;
- title;
- role;
- biography;
- research areas;
- methods;
- instruments;
- software;
- keywords;
- recent publication titles, at a lower and capped weight.

Exact name matches should receive a strong ranking boost.

Publication evidence contributes at most 45 points per person. Exact profile fields remain stronger, publication titles do not alter the controlled vocabulary, and publication overlap never creates Network edges.

A query such as:

```text
Ryan Shannon
```

must not depend on Puter query expansion or an LLM.

SQLite text search, simple indexed queries, or lightweight application-level matching are all acceptable for the small dataset.

---

## 10. Puter-Assisted Controlled Query Expansion

Puter-assisted interpretation exists for natural-language questions and vocabulary mismatch. Puter.js is loaded dynamically only in the browser and may trigger Puter's website authentication flow.

Flow:

```text
user query
    ↓
Puter chat with explicit Gemini model
    ↓
JSON interpretation and proposed vocabulary terms
    ↓
discard terms absent from the server-derived vocabulary
    ↓
submit the original query and validated terms
    ↓
deterministic expanded-term ranking
```

For 25–40 researchers, vector similarity should be calculated directly in application code.

A dedicated vector database is explicitly unnecessary.

The SQL database remains the source of truth.

---

## 11. Hybrid Ranking

Combine:

- exact-name matching;
- lexical field matches;
- exact expertise/topic matches;
- accumulated evidence from validated expansion terms at 35% weight.

The exact formula may be tuned during development.

A reasonable starting approach is:

```text
validated expanded-term evidence
+ lexical relevance
+ exact field boosts
+ strong exact-name boost
```

Do not expose numerical relevance scores to users.

---

## 12. AI Integration

### Core rule

Puter does not create or directly retrieve researcher records. Before retrieval it may propose only terms from the supplied vocabulary, and after retrieval it may reorder only the supplied candidates. The server validates interpreted terms, the browser validates candidate IDs and order, and SQLite remains the identity source of truth.

The browser may interpret a query into controlled terms before retrieval. The explanation call always happens after the server has retrieved the candidate records.

```text
query + server-derived vocabulary
  ↓
Puter interpretation (optional)
  ↓
POST original query + validated terms
  ↓
SQLite deterministic ranking
  ↓
top candidate researchers
  ↓
Puter grounded candidate re-ranking, explanations, and outreach questions (optional)
  ↓
validated query-specific contact order
```

The explanation call receives only:

- the original user query;
- the small candidate set;
- candidate identity fields;
- the stored values and profile excerpts that contributed to deterministic retrieval or ranking;
- metadata for publication titles that contributed to publication scoring.

Each traced match records its field category, literal-query or interpreted-term provenance, matched term, and stored value. Biography evidence is reduced to matched stored sentences. Duplicate raw and interpreted matches are merged, while the UI displays interpreted-only evidence separately. The re-ranking prompt treats curated profile matches as primary evidence. It may use matched publication titles and dates only as fictional ORCID-style supporting evidence of recent topical relevance or to distinguish close candidates, and it prevents claims beyond the supplied titles. The same call drafts a first-person professional outreach question for each candidate. Project and problem details come only from the original query, researcher-specific language comes only from that candidate's matching evidence, and missing context is omitted rather than invented.

Puter must return every supplied candidate in its preferred order. Browser validation discards unknown and duplicate IDs, appends omitted candidates in their original deterministic order, and keeps the original reason for every appended candidate. If the raw query exactly matches a researcher name, that person is moved back to first position after validation. Suggested questions remain candidate-bound and are exposed only on the final top three results. A missing or invalid question is dropped independently without discarding a valid reason or ranking.

---

## 13. Puter Output

Use structured output.

Example:

```json
{
  "interpretation": "Finding people who study pulsars and propagation effects.",
  "interpretedTopics": [
    "pulsars",
    "interstellar scintillation"
  ],
  "searchTerms": ["pulsars", "scintillation analysis"]
}
```

The separate explanation response is:

```json
{
  "recommendations": [
    {
      "researcherId": "researcher_017",
      "reason": "Their stored profile includes work on pulsars and interstellar scintillation.",
      "suggestedQuestion": "I am investigating changes in pulsar brightness. I noticed your work involves interstellar scintillation - would you be able to point me towards the right approach?"
    },
    {
      "researcherId": "researcher_004",
      "reason": "Their listed demo publication supports recent relevance to this specific query.",
      "suggestedQuestion": "I am investigating changes in pulsar brightness. I noticed your listed work relates to this topic - would you be able to suggest a useful starting point?"
    }
  ]
}
```

The browser validates this output with Zod before rendering it. A response containing at least one valid candidate produces a complete validated order; the first candidate is marked `Suggested first contact`, and the final top three candidates may show `Suggested question to ask`. This label is query-specific guidance, not a claim that the person is objectively the best or most qualified researcher. The copy control copies only the question text and keeps it visible if clipboard access fails.

The model cannot introduce new researcher IDs, remove server candidates, or override exact-name precedence.

---

## 14. AI Failure Behaviour

Both Puter calls are optional to successful retrieval.

If Puter fails:

```text
query
  ↓
deterministic lexical retrieval
  ↓
candidate researchers
  ↓
display candidates without generated explanation or suggested question
```

The core search experience must still work.

If Puter authentication is cancelled, allowance is exhausted, the configured model is unavailable, or either call fails, the application preserves the complete deterministic server order and evidence-based reasons. Malformed or empty re-ranking output does not produce a suggested-contact badge.

---

## 15. API

The application exposes two narrow API endpoints.

```http
POST /api/search
```

Input:

```json
{
  "query": "Who knows about pulsar scintillation?",
  "interpretedTerms": ["pulsars", "scintillation analysis"]
}
```

Response:

```json
{
  "interpretedTopics": [],
  "results": [
    {
      "recommendationId": "82b24d4d-a407-4212-af90-27bd985e8817",
      "id": "researcher_017",
      "name": "Daniel Brooks",
      "title": "Research Fellow",
      "researchAreas": [
        "pulsars",
        "radio astronomy"
      ],
      "reason": "Their stored profile includes pulsars and scintillation, matching your search.",
      "evidence": {
        "biography": "...",
        "methods": ["scintillation analysis"],
        "instruments": ["MeerKAT"],
        "software": ["PSRCHIVE"],
        "keywords": ["scintillation"],
        "publications": [],
        "matches": [
          {
            "category": "method",
            "value": "scintillation analysis",
            "origins": ["query", "interpreted"],
            "matchedTerms": ["scintillation", "scintillation analysis"]
          },
          {
            "category": "instrument",
            "value": "MeerKAT",
            "origins": ["query"],
            "matchedTerms": ["MeerKAT"]
          }
        ]
      }
    }
  ]
}
```

```http
POST /api/recommendation-feedback
```

Input:

```json
{
  "recommendationId": "82b24d4d-a407-4212-af90-27bd985e8817",
  "feedback": "helpful",
  "displayedPosition": 1,
  "rankingMode": "ai"
}
```

The endpoint validates the opaque recommendation context, updates its answer in place, and returns the saved feedback value. It does not accept a researcher ID, raw query, or user identifier. Directory, profile, and Network pages continue to read SQLite directly from server components.

---

## 16. No MCP

Do not build an MCP server.

MCP would only become useful if external AI clients need to access the expertise search system.

The MVP has no such requirement.

---

## 17. No Model Tool Calling

Do not expose database functions as model tools.

The server should control the deterministic pipeline:

```text
retrieve → rank → explain
```

This is simpler to test, debug, secure, and understand.

---

## 18. No Dedicated Vector Database

Do not use:

- Pinecone;
- Qdrant;
- Weaviate;
- Milvus;
- dedicated pgvector infrastructure.

The MVP dataset is too small to justify this complexity.

Keep the nullable embedding column for compatibility, but leave it unused. No vector infrastructure or similarity calculation is part of this design.

---

## 19. Ingestion Is Separate and Future Work

The application assumes the database is already populated.

Future ingestion may eventually transform public institutional profiles and ORCID works into the same internal schemas.

The current `orcid-records.json` fixture is local-only. Live ORCID API access, OAuth, external publication links, scheduled refreshes, and automated synchronisation remain outside this repository and outside this MVP.

---

## 20. Final Architecture

The complete MVP architecture is:

```text
┌─────────────────────┐
│    Search UI        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ POST /api/search    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Deterministic Search│
│                     │
│ raw + expanded terms│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ SQLite              │
│                     │
│ researchers         │
│ embedding is null   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Browser Puter AI    │
│ explanation         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Search Results      │
└─────────────────────┘
```

The runtime principle is:

> **interpret terms, retrieve deterministically, explain only retrieved people.**

The MVP should remain this simple until evidence shows that more infrastructure is necessary.
