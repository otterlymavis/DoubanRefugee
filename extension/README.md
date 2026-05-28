# DoubanRefugee Extension

Manifest V3 helper for local-only transfer. It scrapes Douban movie, book, and
music user pages, reads completed items from `/collect` and wanted items from
`/wish`, follows pagination up to a user-selected limit, and creates JSON that
the web app can convert into destination transfer files.

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
