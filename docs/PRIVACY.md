# Privacy Model

DoubanRefugee is local-only by design.

## Defaults

- No backend.
- No account.
- No Douban password storage.
- No Letterboxd, Goodreads, RateYourMusic, Filmarks, or Notion password
  storage.
- No destination-site login proxy.
- No server-side scraping. Scraping runs only in the user's browser tab.
- No remote database.
- No telemetry.

## Storage

- The web app stores the working library in browser `localStorage`.
- The mobile app stores the working library in device local storage.
- The extension extracts the active page or paginated Douban history pages using
  the user's existing browser session, then creates JSON for the user.
- Destination sites receive only files the user explicitly downloads and
  uploads/imports while logged in there.

## User Control

Users can clear local storage, download a backup JSON file, and re-import that
backup later. Sharing or uploading exported files is always a user action.

## Account Boundaries

The project intentionally avoids direct cross-site account sync. This reduces
credential risk and keeps the tool resilient when destination websites change
their login or import flows. Future destination helpers should run in the
browser with the user's active session and should still avoid collecting
passwords.
