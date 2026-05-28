# Privacy Model

DoubanRefugee is local-only by design.

## Defaults

- No backend.
- No account.
- No Douban password storage.
- No server-side scraping. Scraping runs only in the user's browser tab.
- No remote database.
- No telemetry.

## Storage

- The web app stores the working library in browser `localStorage`.
- The mobile app stores the working library in device local storage.
- The extension extracts the active page or paginated Douban history pages using
  the user's existing browser session, then creates JSON for the user.

## User Control

Users can clear local storage, download a backup JSON file, and re-import that
backup later. Sharing or uploading exported files is always a user action.
