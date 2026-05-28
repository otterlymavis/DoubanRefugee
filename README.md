# DoubanRefugee

DoubanRefugee is a local-only migration tool for scraping your own Douban movie,
book, and music history, then converting that history into transfer files for
other tracking sites.

No backend. No database. No accounts. No hosting bill.

## What It Does

- Scrapes paginated Douban collection/history pages from your logged-in browser
  session.
- Imports scraped Douban JSON or pasted Douban HTML in the web app.
- Stores the working library in browser or mobile local storage.
- Exports transfer CSV files for Letterboxd, Filmarks, Goodreads, and
  RateYourMusic.
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

Open your own Douban collection/history page, such as a movie `collect` page,
click the extension icon, choose how many paginated pages to scrape, download
JSON, then import that JSON in the web app. Leave the extension's local web app
address as `http://localhost:3000` unless you serve the static frontend
somewhere else.

For Letterboxd, upload the generated `letterboxd.csv` through Letterboxd's
import flow. Other destinations receive best-effort transfer CSVs that can be
used where import tools or manual spreadsheet workflows are available.

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
