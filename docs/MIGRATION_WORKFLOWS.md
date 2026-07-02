# Migration Workflows

## Login Model

DoubanRefugee is export-first. It never asks for Douban, Letterboxd,
Goodreads, RateYourMusic, Filmarks, or Notion credentials.

- Scraping happens inside the user's already logged-in browser session.
- Destination sites are handled by files the user uploads while logged in there.
- The app should not promise direct account sync unless a future optional
  browser helper is built for a specific site.

## Douban History to Web

1. Sign in to Douban in Chrome or Edge.
2. Open a Douban movie, book, or music user page, for example
   `https://movie.douban.com/people/<id>/collect`,
   `https://book.douban.com/people/<id>/collect`, or
   `https://music.douban.com/people/<id>/collect`.
3. Use the extension's "Scrape whole history" action.
4. Keep the safety limit high enough for the user's history. The extension reads
   both `/collect` and `/wish` for the selected media type, follows Douban
   pagination until there is no next page or the safety limit is reached, and
   deduplicates subject IDs by status.
5. Download or copy JSON.
6. Import the JSON into the web app.
7. Download Letterboxd watched CSV, Letterboxd watchlist CSV, Filmarks,
   Goodreads, RateYourMusic, or backup JSON.

## Transfer Checklist

1. Scrape Douban in the extension.
2. Import JSON in the local app.
3. Review counts and sample rows.
4. Export the destination file.
5. Open the destination site while logged in.
6. Upload/import the file, or use it as a manual transfer spreadsheet.

## Destination Support

| Destination | Best current path |
| --- | --- |
| Letterboxd | Upload `letterboxd.csv` for watched films and `letterboxd-watchlist.csv` for wanted films. |
| Goodreads | Upload/use `goodreads.csv` for completed books. |
| RateYourMusic | Use `rateyourmusic.csv` as a music transfer helper. |
| Filmarks | Use `filmarks.csv` as a movie transfer helper. |
| Notion | Import `notion-douban-media.csv` or `notion-douban-account-backup.csv` as databases. |
| Backup | Keep JSON/Markdown locally for re-import or archive. |

## Whole Account Backup

1. Sign in to Douban in the browser session used by the web app or extension.
2. Enter the Douban user ID in Account Backup.
3. Keep the "Whole account" preset selected, or choose individual sections:
   statuses, diaries, reviews, posts, replies, albums, doulists, profile data,
   follows/followers, and events.
4. Set a conservative page range and run the scrape. The scraper records the
   concrete URLs it requested and any skipped/error pages in backup metadata.
5. Export `douban-account-backup.json` as the canonical archive.
6. Optionally export Markdown for reading or `notion-douban-account-backup.csv`
   for a Notion database.

## Letterboxd Transfer

1. Scrape the Douban movie user pages with the extension.
2. Import the JSON into the web app.
3. Download `letterboxd.csv`.
4. Download `letterboxd-watchlist.csv`.
5. Upload `letterboxd.csv` through Letterboxd's account import flow.
6. Upload `letterboxd-watchlist.csv` through Letterboxd's watchlist import flow.

## Books and Music

1. Choose `book` or `music` in the extension.
2. Scrape the matching Douban user pages.
3. Import the JSON into the web app.
4. Export Goodreads CSV for completed books or RateYourMusic CSV for completed
   music. Wanted items stay in the backup JSON.

## Pasted HTML to Web

1. Copy a Douban HTML export or saved page fragment.
2. Paste it into the web app.
3. Pick movie, book, or music as the media type.
4. Import and export locally.

## Mobile

1. Paste extension JSON or backup JSON into the mobile app.
2. Store the library locally on device.
3. Share destination CSV or backup JSON output.
