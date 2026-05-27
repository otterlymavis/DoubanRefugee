# DoubanRefugee Browser Extension

A Chrome/Edge/Brave Manifest V3 extension that scrapes your Douban movie, book,
and music history and syncs it to the DoubanRefugee web app for migration to
Letterboxd, Goodreads, RateYourMusic, and more.

## Supported Pages

The extension activates on Douban interest list pages:

| URL pattern | What it scrapes |
|---|---|
| `www.douban.com/people/{user}/collect` | All watched/read/listened items |
| `www.douban.com/people/{user}/wish` | Wishlist |
| `www.douban.com/people/{user}/do` | Currently consuming |
| `movie.douban.com/people/{user}/collect` | Movie-specific pages |
| `book.douban.com/people/{user}/collect` | Book-specific pages |
| `music.douban.com/people/{user}/collect` | Music-specific pages |

## Quick Start

### 1. Generate icons (one-time)

Requires Python 3.8+ (stdlib only — no pip installs needed):

```bash
cd extension
python scripts/generate-icons.py
```

This creates `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.

### 2. Load in Chrome / Edge / Brave

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder (the one containing `manifest.json`)

The DoubanRefugee icon will appear in the toolbar.

### 3. Configure the API URL

Click the extension icon → **Settings** → set the API URL to wherever your
DoubanRefugee backend is running (default: `http://localhost:8000`).

### 4. Scrape your Douban history

1. Sign in to Douban in the same browser profile.
2. Navigate to your interest list, e.g.:
   `https://www.douban.com/people/YOUR_USERNAME/collect?type=movie`
3. Click the DoubanRefugee icon → **Scrape All Pages**.
4. The extension will step through every page automatically (1 s delay between
   pages to be polite to Douban's servers).
5. When finished, click **Sync to DoubanRefugee** to push the data to the API.

Your **User ID** is assigned on first sync and shown in the popup. Save it — you
will need it in the web app (Library → Exports → Review).

## Architecture

```
extension/
├── manifest.json              # Manifest V3 config
├── background/
│   └── service-worker.js      # State machine, API calls, pagination
├── content/
│   └── content.js             # Injected into Douban pages; scrapes DOM
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── icons/                     # PNG icons (generate with scripts/generate-icons.py)
└── scripts/
    └── generate-icons.py      # Icon generator (pure stdlib Python)
```

### Data flow

```
Douban page (content.js)
       │  DOM scraping
       ▼
Background service worker
       │  chrome.storage.local (collectedItems[])
       ▼
DoubanRefugee API  POST /api/v1/imports/douban/browser-extension
       │
       ▼
Canonical MediaItem records → Matching → Export (Letterboxd CSV, etc.)
```

## Extracted fields

For each item the content script extracts:

| Field | Source |
|---|---|
| `source_id` | Douban subject ID from URL (`/subject/1234567/`) |
| `titles.zh` | Chinese title text |
| `titles.original` | Alt text from cover image |
| `consumed_date` | Date shown next to the item |
| `rating` | Star class (`rating5-t` → 5/5, etc.) |
| `review` | Comment text |
| `tags` | User-defined tags |
| `media_type` | Inferred from hostname/URL param |
| `interest_type` | `collect` / `wish` / `do` |

## Privacy

- The extension only reads Douban pages you navigate to yourself.
- No Douban credentials are stored.
- Data is only sent to the API URL you configure (default: localhost).
- Nothing is sent to any third-party server.

## Firefox support

Firefox supports Manifest V3 from version 109+.  The extension should work
without modification.  Load it via `about:debugging` → **This Firefox** →
**Load Temporary Add-on** → select `manifest.json`.
