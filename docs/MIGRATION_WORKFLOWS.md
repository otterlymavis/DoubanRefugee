# Migration Workflows

## Douban History to Web

1. Sign in to Douban in Chrome or Edge.
2. Open your own Douban collection/history page for movies, books, or music.
3. Use the extension's "Scrape history pages" action.
4. Pick a page limit. The extension follows Douban pagination from the current
   page and deduplicates subject IDs.
5. Download or copy JSON.
6. Import the JSON into the web app.
7. Download Letterboxd, Filmarks, Goodreads, RateYourMusic, or backup JSON.

## Current Page to Web

1. Open a Douban subject, collection, or list page.
2. Use the extension to extract only the current visible page.
3. Download or copy JSON.
4. Import the JSON into the web app.
5. Download Letterboxd, Filmarks, Goodreads, RateYourMusic, or backup JSON.

## Letterboxd Transfer

1. Scrape Douban movie history with the extension.
2. Import the JSON into the web app.
3. Download `letterboxd.csv`.
4. Upload that CSV through Letterboxd's import flow.

## Pasted HTML to Web

1. Copy a Douban HTML export or saved page fragment.
2. Paste it into the web app.
3. Pick movie, book, or music as the media type.
4. Import and export locally.

## Mobile

1. Paste extension JSON or backup JSON into the mobile app.
2. Store the library locally on device.
3. Share destination CSV or backup JSON output.
