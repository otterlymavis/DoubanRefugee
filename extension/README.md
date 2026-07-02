# DoubanRefugee Extension

Manifest V3 helper for local-only transfer. It scrapes Douban movie, book, and
music user pages, reads completed items from `/collect` and wanted items from
`/wish`, follows pagination up to a user-selected limit, and creates JSON that
the web app can convert into destination transfer files.

It can also back up visible Douban account data into JSON for Markdown, Notion
CSV, or canonical account backup JSON in the web app. Account backup covers
statuses, diaries/notes, reviews, group posts, visible replies/comments, albums
and photos, doulists, profile metadata, visible follows/followers, and events
when Douban exposes them to the current browser session.

The extension uses the user's active browser session. It does not ask for or
store passwords, and it does not log into destination websites. Destination
transfer still happens by downloading files and uploading/importing them while
logged into each destination site.

## Load It

1. Open Chrome or Edge and go to `chrome://extensions`.
2. Enable Developer Mode.
3. Choose "Load unpacked".
4. Select this folder: `extension`.

## Use It

1. Sign in to Douban and open a Douban user page, such as
   `https://movie.douban.com/people/<id>/collect`,
   `https://book.douban.com/people/<id>/collect`, or
   `https://music.douban.com/people/<id>/collect`.
2. Click the DoubanRefugee extension icon.
3. Select the media type.
4. Set "History page safety limit" high enough for the whole history.
5. Click "Scrape whole history".
6. Click "Download JSON" or "Copy JSON".
7. Import that JSON in the local web app and export Letterboxd watched/watchlist
   CSV files, Goodreads, RateYourMusic, Filmarks, or backup JSON.

## Account Backup

1. Open a Douban user page such as `https://www.douban.com/people/<id>/`.
2. In the Account backup section, choose the sections to preserve.
3. Set the start and end page for paginated sections.
4. Click "Scrape account data". You can cancel after the current page finishes.
5. Download or copy the account JSON.
6. Import it in the web app's Account Backup panel, then export Markdown,
   `douban-account-backup.json`, or `notion-douban-account-backup.csv`.
