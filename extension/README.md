# DoubanRefugee Extension

Manifest V3 helper for local-only transfer. It scrapes the user's own logged-in
Douban collection/history pages, follows pagination up to a user-selected limit,
and creates JSON that the web app can convert into destination transfer files.

## Load It

1. Open Chrome or Edge and go to `chrome://extensions`.
2. Enable Developer Mode.
3. Choose "Load unpacked".
4. Select this folder: `extension`.

## Use It

1. Sign in to Douban and open your own collection/history page.
2. Click the DoubanRefugee extension icon.
3. Select the media type.
4. Set "History page safety limit" high enough for the whole history.
5. Click "Scrape whole history".
6. Click "Download JSON" or "Copy JSON".
7. Import that JSON in the local web app and export a transfer CSV.
