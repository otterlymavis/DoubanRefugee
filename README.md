# DoubanRefugee

DoubanRefugee is a privacy-first cultural history backup and migration platform.
exports destination-compatible files for Letterboxd, Filmarks, Goodreads, and
RateYourMusic. Crucially, it supports robust local backups and seamless syncing
with Notion for personal database management.

## MVP Scope

Phase 1 is implemented as a production-ready foundation:

- Douban movie backup ingestion from browser-extension payloads or HTML exports.
- Canonical media schema for movies, books, and music.
- Export to Letterboxd CSV, robust local backups (JSON/CSV archives), and Notion syncing.
- Matching engine foundations with TMDb, Open Library, and MusicBrainz providers.
- Manual review API and UI for uncertain matches.
- FastAPI backend, PostgreSQL, Redis, Dramatiq worker, and Next.js frontend.

## Repository Layout

```text
backend/       FastAPI app, SQLAlchemy models, services, workers, tests
frontend/      Next.js App Router UI — Dashboard, Library, Review, Exports, Settings
extension/     Manifest V3 browser extension — scrapes Douban pages and syncs to API
docs/          Architecture, privacy, migration, and deployment notes
docker-compose.yml
.env.example
```

## Web App Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — migration wizard, canonical ledger, phase tracker |
| `/library` | Browse all imported media items; run matching |
| `/review` | Manual review queue — pick the correct match for uncertain items |
| `/exports` | Generate and download Letterboxd, Goodreads, RYM, local backups, and trigger Notion syncs |
| `/settings` | Account info, API URL configuration, account deletion |

## Browser Extension

The extension scrapes your Douban interest list pages (watched movies, read
books, listened albums and their ratings, dates, and reviews) and pushes the
data directly to the DoubanRefugee API.

**Install:**
```bash
# 1. Generate icons (Python stdlib only — no pip install needed)
cd extension
python scripts/generate-icons.py

# 2. Load in Chrome
#    chrome://extensions → Developer mode → Load unpacked → select extension/
```

See [extension/README.md](extension/README.md) for the full guide.

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
