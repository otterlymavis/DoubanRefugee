# DoubanRefugee

DoubanRefugee is a local-only migration tool for scraping a Douban user's movie
history, then converting watched movies and watchlist entries into transfer
files for Letterboxd and other tracking sites.

No backend. No database. No accounts. No hosting bill.

## What It Does

- Scrapes Douban movie user pages, using `/collect` for watched movies and
  `/wish` for watchlist entries.
- Preserves watched ratings, marked dates, tags, and short reviews/comments
  when Douban exposes them on the user history page.
- Imports scraped Douban JSON or pasted Douban HTML in the web app.
- Stores the working library in browser or mobile local storage.
- Exports separate Letterboxd watched-history and Letterboxd watchlist CSV
  files, plus transfer CSV files for Filmarks, Goodreads, and RateYourMusic.
- Exports a full `douban-refugee-backup.json` file that can be re-imported.
- Keeps the transfer step user-controlled: download the generated file, then
  upload/import it on the destination site where that site supports imports.

## Repository Layout

```text
frontend/      Static Next.js local web app
extension/     Manifest V3 Douban JSON extractor
mobile/        Expo React Native local app for Android and iOS
docs/          Architecture, privacy, and local testing notes
```

## Quick Start

Web app:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. This is the local web app address, not an API
base URL. No backend URL is needed.

Extension:

```text
Open chrome://extensions, enable Developer Mode, choose Load unpacked,
and select the extension/ folder.
```

Open your Douban movie user page, such as `https://movie.douban.com/people/<id>/collect`,
click the extension icon, choose "Scrape whole history", download JSON, then
import that JSON in the web app. The extension automatically reads both
`/collect` and `/wish` for that movie user and follows pagination until each
section ends or the safety limit is reached. Leave the extension's local web app
address as `http://localhost:3000` unless you serve the static frontend somewhere
else.

For Letterboxd, upload `letterboxd.csv` through the normal account import flow
and upload `letterboxd-watchlist.csv` through Letterboxd's watchlist import
flow. Other destinations receive best-effort transfer CSVs that can be used
where import tools or manual spreadsheet workflows are available.

Mobile app:

```bash
cd mobile
npm ci
npm run android
```

Use `npm run ios` on macOS. The mobile app is also local-only: import JSON or
demo records, then share CSV/backup output.

See [Architecture](docs/ARCHITECTURE.md), [Schema](docs/SCHEMA.md),
[Migration Workflows](docs/MIGRATION_WORKFLOWS.md), and
[Privacy](docs/PRIVACY.md).
