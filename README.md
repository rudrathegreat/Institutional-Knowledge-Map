# Institutional Expertise Navigator

A minimal institutional search interface that answers one question: **Who should I talk to?**

This first milestone provides server-side lexical search over a deterministic SQLite database containing 30 fictional astronomy researchers. Semantic retrieval, embeddings, and AI-generated explanations are intentionally deferred.

## Run locally

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Current scope

- One responsive, accessible search screen
- Exact-name and weighted keyword retrieval
- Search across names, roles, biographies, research areas, methods, instruments, software, and keywords
- Ranked database-backed people results with deterministic relevance reasons
- Loading, validation, error, and empty-result states
- Repository-controlled fictional seed data

The product and technical requirements are documented in [`docs/`](docs/). Real institutional data, profile pages, filters, authentication, semantic search, and generative AI are not included in this milestone.

All researcher identities and biographies in the seed data are fictional. Any resemblance to a real person is coincidental.
