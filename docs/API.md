# API Overview

OpenAPI documentation is available at `/docs` when the backend is running.

## Core Routes

- `POST /api/v1/imports/douban/browser-extension`
- `POST /api/v1/imports/douban/html`
- `GET /api/v1/media`
- `POST /api/v1/matching/run`
- `GET /api/v1/review-queue`
- `POST /api/v1/review-queue/{candidate_id}/select`
- `POST /api/v1/exports`
- `GET /api/v1/exports/{job_id}`
- `GET /api/v1/exports/{job_id}/download`
- `DELETE /api/v1/account`

## Export Destinations

`POST /api/v1/exports` accepts these `destination` values:

- `letterboxd` for movie CSV export.
- `filmarks` for movie CSV export.
- `goodreads` for book CSV export.
- `rateyourmusic` for music CSV export.
- `archive` for a full backup ZIP with canonical JSON and Markdown files.

