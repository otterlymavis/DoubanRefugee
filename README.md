# DoubanRefugee

DoubanRefugee is a local-only migration tool for scraping a Douban user's movie,
book, or music history, then converting completed and wanted items into transfer
files for Letterboxd and other tracking sites.

No backend. No database. No account connection layer. No hosting bill.

## What It Does

- Scrapes Douban movie, book, and music user pages, using `/collect` for
  completed items and `/wish` for wanted/watchlist entries.
- Backs up visible Douban account data including statuses, diaries, reviews,
  posts, replies/comments, albums/photos, doulists, profile metadata, visible
  follows/followers, and events.
- Preserves ratings, marked dates, tags, short reviews/comments, source links,
  poster URLs, release dates, creators, and countries when Douban exposes them
  on the user history page.
- Imports scraped Douban JSON or pasted Douban HTML in the web app.
- Stores the working library in browser or mobile local storage.
- Exports separate Letterboxd watched-history and Letterboxd watchlist CSV
  files, plus transfer CSV files for Filmarks, Goodreads, and RateYourMusic.
- Exports a full `douban-refugee-backup.json` file that can be re-imported.
- Exports account data as Markdown or canonical `douban-account-backup.json`.
- Exports Notion-ready CSV files for media libraries and account archives, plus
  account Markdown that Notion can import as pages.
- Keeps the transfer step user-controlled: download the generated file, then
  upload/import it on the destination site where that site supports imports.

## Login and Transfer Model

DoubanRefugee does not collect passwords and does not try to log into
Letterboxd, Goodreads, RateYourMusic, Filmarks, Notion, or Douban on your
behalf.

1. Sign in to Douban normally in Chrome or Edge.
2. Use the extension in that same browser session to scrape pages you can see.
3. Import the downloaded JSON into the local web or mobile app.
4. Download transfer files.
5. Open each destination site yourself while logged in, then upload/import the
   generated file where that site supports it.

Current destination support:

| Destination | Output | User action |
| --- | --- | --- |
| Letterboxd | Watched CSV and watchlist CSV | Upload through Letterboxd's logged-in import screens. |
| Goodreads | Completed-books CSV | Import while logged into Goodreads. |
| RateYourMusic | Music CSV helper | Use as staging data for import/manual entry workflows. |
| Filmarks | Movie CSV helper | Use as a spreadsheet/manual transfer helper. |
| Notion | Media/account CSV and account Markdown | Import CSV as a database or Markdown as pages. |
| Backup | JSON and Markdown | Keep locally or re-import later. |

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

Open your Douban user page, such as `https://movie.douban.com/people/<id>/collect`
or `https://book.douban.com/people/<id>/collect`, click the extension icon,
choose the media type, choose "Scrape whole history", download JSON, then import
that JSON in the web app. The extension automatically reads both `/collect` and
`/wish` for the selected movie/book/music user and follows pagination until each
section ends or the safety limit is reached. Leave the extension's local web app
address as `http://localhost:3000` unless you serve the static frontend somewhere
else.

For whole-account backup, open `https://www.douban.com/people/<id>/`, choose the
sections and page range in the extension's Account backup section, then import
the downloaded JSON in the web app's Account Backup panel. The web app can
export the entries as Markdown, Notion account CSV, or canonical backup JSON.

For Notion, import `notion-douban-media.csv` or
`notion-douban-account-backup.csv` as a new Notion database. You can also import
the account Markdown file as Notion pages if you prefer a narrative archive.

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
