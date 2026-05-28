# Local Testing

## Web App

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. This is the local web app address, not an API
base URL. Import scraped Douban JSON from the extension, demo data, or pasted
Douban HTML. Export each destination file from the browser.

## Extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable Developer Mode.
4. Click "Load unpacked".
5. Select the repository's `extension` folder.
6. Sign in to Douban and open your own collection/history page.
7. Click the DoubanRefugee extension icon.
8. Leave "Local web app address" as `http://localhost:3000` unless you serve the
   frontend somewhere else.
9. Set "History page safety limit" to a small number for testing, or leave it
   high for a full history scrape.
10. Click "Scrape whole history".
11. Download or copy JSON.
12. Import that JSON in the web app.

## Mobile App

```bash
cd mobile
npm ci
npm run android
```

On macOS, use `npm run ios` to launch the iOS simulator. The mobile app imports
demo records or pasted JSON and shares CSV/backup output through the OS share
sheet.

## Verification Commands

```bash
cd frontend
npm run typecheck
npm run build
```

```bash
cd mobile
npm run typecheck
npx expo export --platform android --output-dir dist/android
npx expo export --platform ios --output-dir dist/ios
```
