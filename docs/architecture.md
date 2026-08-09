# Institutional Expertise Navigator — Minimal MVP Architecture

## 1. Architectural Goal

The MVP backend should be as small and understandable as possible.

The system only needs to:

1. store mock researcher records;
2. accept a search query;
3. perform lexical and semantic retrieval;
4. rank matching researchers;
5. optionally ask an LLM to explain the matches;
6. return the results.

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
        lexical retrieval    semantic retrieval
                 \                /
                  \              /
                   merged ranking
                          │
                          ▼
                 candidate people
                          │
                          ▼
                    optional LLM
                          │
                          ▼
                 relevance reasons
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
- OpenAI API for embeddings
- OpenAI API for optional result explanation

Do not create a separate backend application.

Do not create a Python service.

---

## 4. Minimal Repository Structure

```text
institutional-expertise-navigator/
│
├── app/
│   ├── page.tsx
│   └── api/
│       └── search/
│
├── components/
│   ├── SearchBar.tsx
│   └── SearchResult.tsx
│
├── lib/
│   ├── db.ts
│   ├── search.ts
│   ├── embeddings.ts
│   └── ai.ts
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

No additional application surfaces are required.

---

## 5. Database

Use SQLite.

The MVP only requires researcher data.

A simple schema is sufficient.

### `researchers`

Recommended fields:

```text
id
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

A single table is acceptable for the MVP.

Normalisation into multiple tables is not required unless it significantly simplifies implementation.

---

## 6. Search Document

Each researcher should have one normalised text representation used for semantic retrieval.

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

This text is embedded once and stored with the researcher.

---

## 7. Mock Data

The repository contains:

```text
data/researchers.json
```

Use approximately 25–40 fictional researchers with overlapping expertise.

A seed command populates SQLite:

```bash
npm run db:seed
```

The seed process should insert researcher records and their stored embeddings.

Embeddings may either be:

- pre-generated and included with the mock seed data; or
- generated through an explicit seed command.

The application must not regenerate every researcher embedding on startup.

---

## 8. Search Architecture

The MVP uses hybrid retrieval.

```text
                       QUERY
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       lexical search          semantic search
             │                       │
 name / topic / fields        query embedding
             │                       │
             ▼                       ▼
       lexical score          cosine similarity
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
- keywords.

Exact name matches should receive a strong ranking boost.

A query such as:

```text
Ryan Shannon
```

must not depend on semantic search or an LLM.

SQLite text search, simple indexed queries, or lightweight application-level matching are all acceptable for the small dataset.

---

## 10. Semantic Retrieval

Semantic retrieval exists for natural-language questions and vocabulary mismatch.

Flow:

```text
user query
    ↓
embedding API
    ↓
query vector
    ↓
compare against stored researcher embeddings
    ↓
cosine similarity
    ↓
semantic ranking
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
- semantic similarity.

The exact formula may be tuned during development.

A reasonable starting approach is:

```text
semantic similarity
+ lexical relevance
+ exact field boosts
+ strong exact-name boost
```

Do not expose numerical relevance scores to users.

---

## 12. AI Integration

### Core rule

The LLM does not retrieve researchers.

The application retrieves researchers first.

```text
query
  ↓
search service
  ↓
SQLite
  ↓
top candidate researchers
  ↓
LLM
  ↓
short grounded explanations
```

The model receives only:

- the original user query;
- the small candidate set;
- stored profile fields for those candidates.

---

## 13. LLM Output

Use structured output.

Example:

```json
{
  "interpreted_topics": [
    "pulsars",
    "interstellar scintillation"
  ],
  "recommendations": [
    {
      "researcher_id": "researcher_017",
      "reason": "Their stored profile includes work on pulsars and interstellar scintillation."
    }
  ]
}
```

The server validates this output before returning it to the client.

The model cannot introduce new researcher IDs.

---

## 14. AI Failure Behaviour

The AI explanation layer is optional to successful retrieval.

If the LLM fails:

```text
query
  ↓
hybrid retrieval
  ↓
candidate researchers
  ↓
display candidates without generated explanation
```

The core search experience must still work.

If embedding generation fails, the system should fall back to lexical retrieval where possible.

---

## 15. API

Only one application API endpoint is required.

```http
POST /api/search
```

Input:

```json
{
  "query": "Who knows about pulsar scintillation?"
}
```

Response:

```json
{
  "interpretedTopics": [
    "pulsars",
    "interstellar scintillation"
  ],
  "results": [
    {
      "id": "researcher_017",
      "name": "Daniel Brooks",
      "title": "Research Fellow",
      "researchAreas": [
        "pulsars",
        "radio astronomy"
      ],
      "reason": "Their stored profile includes work on pulsars and interstellar scintillation."
    }
  ]
}
```

No other public API surface is required for the MVP.

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

Store embeddings with researcher records in SQLite and calculate similarity in application code.

---

## 19. Ingestion Is Separate and Future Work

The application assumes the database is already populated.

Future ingestion may eventually transform public institutional profiles into the same researcher schema.

That future system is outside this repository and outside this MVP.

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
│ Hybrid Search       │
│                     │
│ lexical + semantic  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ SQLite              │
│                     │
│ researchers         │
│ embeddings          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Optional LLM        │
│ explanation         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Search Results      │
└─────────────────────┘
```

The runtime principle is:

> **retrieve first, explain second.**

The MVP should remain this simple until evidence shows that more infrastructure is necessary.
