# DoubanRefugee

DoubanRefugee is a local-only tool for backing up Douban movie, book, and music
history and converting it into portable files.

No backend. No database. No accounts. No hosting bill.

## What It Does

- Imports JSON from the browser extension.
- Imports pasted Douban HTML in the web app.
- Stores the working library in browser or mobile local storage.
- Exports CSV files for Letterboxd, Filmarks, Goodreads, and RateYourMusic.
- Exports a full `douban-refugee-backup.json` file that can be re-imported.

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

Open `http://localhost:3000`.

Extension:

```text
Open chrome://extensions, enable Developer Mode, choose Load unpacked,
and select the extension/ folder.
```

Open a Douban page, click the extension icon, download JSON, then import that
JSON in the web app.

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
