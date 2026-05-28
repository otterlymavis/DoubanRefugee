# Privacy Model

DoubanRefugee is local-only by design.

## Defaults

- No backend.
- No account.
- No Douban password storage.
- No server-side scraping.
- No remote database.
- No telemetry.

## Storage

- The web app stores the working library in browser `localStorage`.
- The mobile app stores the working library in device local storage.
- The extension only extracts the active page and creates JSON for the user.

## User Control

Users can clear local storage, download a backup JSON file, and re-import that
backup later. Sharing or uploading exported files is always a user action.
