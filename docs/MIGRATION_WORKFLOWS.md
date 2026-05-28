# Migration Workflows

## Douban History to Web

1. Sign in to Douban in Chrome or Edge.
2. Open a Douban movie user page, for example
   `https://movie.douban.com/people/<id>/collect`.
3. Use the extension's "Scrape whole history" action.
4. Keep the safety limit high enough for the user's history. The extension reads
   both `/collect` and `/wish`, follows Douban pagination until there is no next
   page or the safety limit is reached, and deduplicates subject IDs by status.
5. Download or copy JSON.
6. Import the JSON into the web app.
7. Download Letterboxd watched CSV, Letterboxd watchlist CSV, Filmarks,
   Goodreads, RateYourMusic, or backup JSON.

## Letterboxd Transfer

1. Scrape the Douban movie user pages with the extension.
2. Import the JSON into the web app.
3. Download `letterboxd.csv`.
4. Download `letterboxd-watchlist.csv`.
5. Upload `letterboxd.csv` through Letterboxd's account import flow.
6. Upload `letterboxd-watchlist.csv` through Letterboxd's watchlist import flow.

## Pasted HTML to Web

1. Copy a Douban HTML export or saved page fragment.
2. Paste it into the web app.
3. Pick movie, book, or music as the media type.
4. Import and export locally.

## Mobile

1. Paste extension JSON or backup JSON into the mobile app.
2. Store the library locally on device.
3. Share destination CSV or backup JSON output.
