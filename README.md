# Institutional Expertise Navigator

A focused institutional expertise directory that helps users answer one question: **Who should I talk to?**

The application provides Puter-assisted natural-language search, an alphabetical people directory, detailed person profiles, and an interactive shared-expertise network backed by a deterministic SQLite database containing 30 fictional astronomy researchers. Puter interprets ordinary-language needs into a controlled expertise vocabulary, re-ranks server-retrieved candidates for the specific query, and generates evidence-grounded match explanations; deterministic lexical search remains available whenever AI is unavailable.

## Run locally

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first AI-assisted search may prompt the user to sign in to Puter. AI usage is charged to that user's Puter account under Puter's user-pays model; no application API key is required. Cancelling sign-in, exhausting an allowance, or encountering a model error simply falls back to directory-keyword search.

On Windows PowerShell systems that block npm's PowerShell wrapper, use the equivalent `npm.cmd` commands.

## Commands

```bash
npm run db:seed     # Create or refresh data/expertise.sqlite
npm run dev         # Start the development server
npm run lint        # Run ESLint
npm test            # Run the automated test suite
npm run build       # Create a production build
```

Set `DATABASE_PATH` to use a different SQLite file. The browser never receives direct database access.

Copy `.env.example` to `.env.local` only if you need to override the public Puter model configuration. The default and recommended value is:

```text
NEXT_PUBLIC_PUTER_AI_MODEL=google/gemini-3.1-flash-lite
```

The application always supplies an explicit model and temperature of zero. OpenAI-prefixed configuration is rejected and causes lexical fallback instead of allowing Puter.js to select a default model.

## Current scope

- One responsive, accessible search screen
- Exact-name and weighted keyword retrieval
- Controlled, database-derived expertise vocabulary
- Browser-side Puter query interpretation using an explicit Google Gemini model
- Weighted query expansion (`raw lexical score + 0.35 × expanded-term score`)
- Search across names, roles, biographies, research areas, methods, instruments, software, keywords, and low-weight recent-publication titles
- Candidate-constrained Puter re-ranking using curated expertise as primary evidence and recent publications as supporting evidence
- A query-specific `Suggested first contact` marker after successful AI re-ranking, with deterministic ordering and reasons as the fallback
- Twenty searches per IP per minute on the SQLite search endpoint
- Persistent Search, People, and Network navigation
- Alphabetical directory of every stored researcher
- Stable, human-readable profile URLs with detailed expertise information
- Clearly labelled mock ORCID iDs and three newest-first fictional publications on every profile
- Interactive people network derived deterministically from shared profile fields
- Name-based graph navigation, connection evidence, and profile links
- Loading, validation, error, and empty-result states
- Repository-controlled fictional seed data with 30 detailed biographies and 90 ORCID-style publication records

The product and technical requirements are documented in [`docs/`](docs/). Real institutional data, advanced network filters, curated collaboration data, application-managed authentication, embeddings, and vector databases are not included in this milestone.

All researcher identities, ORCID-style identifiers, biographies, and publications in the seed data are fictional. Mock ORCID iDs are deliberately non-production identifiers and do not link to ORCID records. Any resemblance to a real person or publication is coincidental.
