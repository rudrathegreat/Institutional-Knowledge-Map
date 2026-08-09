# Institutional Expertise Navigator — Product Overview

## 1. Product Summary

The Institutional Expertise Navigator MVP answers one question:

> **Who should I talk to about this?**

A user enters a name, topic, method, instrument, software term, or natural-language research question into a single search bar.

The system returns a short list of relevant people and explains why each person may be useful to approach.

Users can also browse the complete people directory and open a profile containing the stored evidence behind each person's expertise.

---

## 2. Core Problem

Research institutions contain a large amount of expertise, but students and researchers often do not know:

- who works on a particular topic;
- who uses a particular method or instrument;
- what technical terminology describes their problem;
- which person is most relevant to approach.

Traditional staff directories work best when the user already knows what to search for.

This MVP allows the user to describe the problem in their own words.

---

## 3. MVP Product Thesis

> **A user should be able to describe a problem in ordinary language and receive a small, credible set of relevant people, with concise evidence explaining each recommendation.**

The system must help the user find humans.

It must not become an AI tutor or general research assistant.

---

## 4. Primary Users

The initial use cases are:

- ASTRAL students trying to identify relevant staff or researchers;
- PhD students and early-stage researchers trying to navigate expertise within an institution.

The MVP uses the same interface for both.

---

## 5. The Entire User Experience

The application has a primary search screen plus a lightweight people directory and person profiles, connected by persistent Search and People navigation.

```text
                Who should I talk to?

┌───────────────────────────────────────────────┐
│ Search a person, topic, method, or question… │
└───────────────────────────────────────────────┘

                    Search
```

Example queries:

```text
Ryan Shannon
```

```text
pulsar timing
```

```text
MeerKAT
```

```text
My pulsar observations vary in brightness between observations and I
am trying to work out whether the cause is instrumental or astrophysical.
```

The result is a ranked list of people.

Example:

```text
Daniel Brooks
Pulsars · Radio Astronomy · Scintillation

Why this person may be relevant
Their stored profile identifies work on pulsars and interstellar
scintillation, which overlaps strongly with your question.


Maya Chen
Pulsars · Pulsar Timing · Time-Series Analysis

Why this person may be relevant
Their work on pulsar observations and timing makes them another
relevant person to approach.
```

No chat thread is created.

No scientific answer is generated.

---

## 6. MVP Features

The MVP contains only the following product features:

1. One unified search bar.
2. Traditional lexical search.
3. Puter-assisted interpretation into a controlled expertise vocabulary.
4. Deterministic ranking combining the raw query with validated expanded terms.
5. Search results containing relevant people.
6. Short AI-generated explanations of why each returned person may be relevant.
7. Graceful fallback to non-AI search results when AI explanation generation fails.
8. An alphabetical directory of all stored researchers.
9. Detailed person profiles linked from the directory and search results.
10. Mock researcher data stored in a simple relational database.

---

## 7. Search Behaviour

The same search bar must support:

### Exact person search

```text
Ryan Shannon
```

Use strong lexical/name matching.

### Topic search

```text
pulsars
```

Use raw lexical matching plus Puter-assisted controlled query expansion.

### Method, instrument, or software search

```text
Bayesian modelling
MeerKAT
TEMPO2
```

Use stored structured profile fields.

### Natural-language problem

```text
My pulse arrival times seem to drift and I do not know what type of
analysis I should be looking at.
```

Ask Puter to select related terms from the directory vocabulary, then let the server validate and rank those terms deterministically.

---

## 8. AI Responsibilities

The AI layer is deliberately narrow.

Puter AI may:

- interpret a complex natural-language query;
- explain why retrieved people are relevant.

Puter AI must not:

- answer the scientific question;
- invent people;
- browse external websites;
- query the database directly;
- search the institution autonomously;
- recommend a person not returned by the retrieval layer;
- make unsupported claims about a person's expertise.

The retrieval system chooses the candidate people.

The LLM only interprets and explains.

Puter.js runs only in the browser with the explicit `google/gemini-3.1-flash-lite` model at temperature zero. Puter may prompt users to sign in, and AI usage is funded by their Puter account. If sign-in is cancelled or AI is otherwise unavailable, the same screen continues with raw lexical search and deterministic reasons.

---

## 9. MVP Data

The first version uses mock data only.

Use approximately 25–40 fictional researchers or staff.

The mock data should deliberately contain overlapping expertise so the ranking system can be meaningfully tested.

Each researcher should contain fields such as:

- name;
- title;
- role;
- biography;
- research areas;
- methods;
- instruments;
- software;
- keywords;
- searchable profile text;
- a nullable, unused embedding compatibility field.

---

## 10. Explicitly Out of Scope

The following must not be implemented in the MVP.

### Additional product surfaces

- related-people recommendations;
- researcher maps;
- network graphs;
- topic maps;
- filters;
- dashboards;
- feeds;
- saved searches;
- search history.

### Data ingestion

- Swinburne scraping;
- institutional profile ingestion;
- web crawling;
- scheduled refreshes;
- publication ingestion;
- bibliometric APIs;
- automated data synchronisation.

### AI infrastructure

- chatbot;
- RAG assistant;
- scientific question answering;
- autonomous agents;
- multi-agent systems;
- model tool calling;
- MCP server;
- external AI integrations;
- autonomous database access.

### Backend infrastructure

- dedicated vector database;
- graph database;
- Redis;
- Elasticsearch;
- message queues;
- background workers;
- microservices;
- separate Python backend;
- separate inference service.

### User and collaboration features

- authentication;
- user accounts;
- student profiles;
- messaging;
- email integration;
- meeting scheduling;
- calendar integration;
- notifications;
- researcher ratings;
- expertise scores;
- social features.

Do not add these for future-proofing.

---

## 11. MVP Success Criteria

The MVP is successful if it can reliably demonstrate:

1. searching an exact researcher name;
2. searching a research topic;
3. searching a method, instrument, or software term;
4. entering a natural-language problem without exact technical vocabulary;
5. returning plausible people;
6. explaining the relevance of those people using stored profile evidence;
7. continuing to return basic results if the explanation model fails;
8. never answering the user's research question instead of routing them to a person;
9. browsing every stored person alphabetically;
10. opening the same detailed person profile from either browsing or search.

---

## 12. Product Principle

The complete MVP loop is:

```text
User query
    ↓
Retrieve relevant people
    ↓
Rank them
    ↓
Explain why they may be relevant
    ↓
Display results or browse people
    ↓
Open a grounded person profile
```

The product should feel like an intelligent institutional search engine, not an AI assistant.
