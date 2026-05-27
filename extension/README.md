# DoubanRefugee Test Extension

This is a minimal Manifest V3 extension for local testing. It extracts visible
Douban subject/list entries from the active tab and sends them to the local
DoubanRefugee backend.

## Load It

1. Start the backend at `http://localhost:8000`.
2. Open Chrome or Edge and go to `chrome://extensions`.
3. Enable Developer Mode.
4. Choose "Load unpacked".
5. Select this folder: `extension`.

## Test It

1. Open a Douban subject, collection, or list page.
2. Click the DoubanRefugee extension icon.
3. Confirm the API base URL is `http://localhost:8000`.
4. Select the media type.
5. Click "Extract page".
6. Click "Import to API".
7. Open the web app at `http://localhost:3000` and continue matching/export.

The extension stores the returned `user_id` in extension local storage so repeat
imports append/update records for the same test user.
