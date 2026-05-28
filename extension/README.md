# DoubanRefugee Extension

Manifest V3 helper for local-only transfer. It scrapes Douban movie, book, and
music user pages, reads completed items from `/collect` and wanted items from
`/wish`, follows pagination up to a user-selected limit, and creates JSON that
the web app can convert into destination transfer files.

It can also scrape Douban broadcast/status pages from `/statuses` into JSON for
Markdown backup in the web app.

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

## Status Backup

1. Open `https://www.douban.com/people/<id>/statuses`.
2. In the Status backup section, set the start and end page.
3. Click "Scrape statuses". You can cancel after the current page finishes.
4. Download or copy the status JSON.
5. Import it in the web app's Status Backup panel, then export Markdown or a
   status backup JSON.
