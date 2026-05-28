# Deployment

The core tool is static. There is no backend to deploy.

## Web

Build the static web app:

```bash
cd frontend
npm ci
npm run build
```

The Next.js app uses `output: "export"`, so it can be hosted on any static host
or opened through the development server for local use.

## Extension

Load `extension/` as an unpacked Chrome or Edge extension during testing. For a
store release, zip the folder and submit it through the browser store process.

## Mobile

Run locally with Expo:

```bash
cd mobile
npm ci
npm run android
```

For distributable Android/iOS builds, use the EAS profiles in `mobile/eas.json`.
iOS distribution still requires Apple signing credentials.
