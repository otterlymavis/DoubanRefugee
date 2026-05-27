# DoubanRefugee

DoubanRefugee is a privacy-first cultural history backup and migration platform.
It preserves Douban movie, book, and music histories in a canonical schema, then
exports destination-compatible files for Letterboxd, Filmarks, Goodreads, and
RateYourMusic.

## MVP Scope

Phase 1 is implemented as a production-ready foundation:

- Douban movie backup ingestion from browser-extension payloads or HTML exports.
- Canonical media schema for movies, books, and music.
- Letterboxd CSV export and archive bundle generation.
- Matching engine foundations with TMDb, Open Library, and MusicBrainz providers.
- Manual review API and UI for uncertain matches.
- FastAPI backend, PostgreSQL, Redis, Dramatiq worker, and Next.js frontend.

## Repository Layout

```text
backend/       FastAPI app, SQLAlchemy models, services, workers, tests
frontend/      Next.js App Router UI with Tailwind and shadcn-style primitives
docs/          Architecture, privacy, migration, and deployment notes
docker-compose.yml
.env.example
```

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:3000

Backend API: http://localhost:8000/docs

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The Vercel CLI is not installed in this environment. Installing it with
`npm i -g vercel` will unlock workflows such as `vercel env pull`,
`vercel deploy`, and `vercel logs`.

See [Architecture](docs/ARCHITECTURE.md), [Schema](docs/SCHEMA.md),
[Migration Workflows](docs/MIGRATION_WORKFLOWS.md), and
[Privacy](docs/PRIVACY.md) for the system design.

## Privacy Defaults

- No Douban password storage.
- Session cookies are encrypted before persistence.
- Export jobs expire by policy.
- Account deletion removes user-owned records and encrypted session data.
- Browser-extension extraction is preferred over server-side scraping.
