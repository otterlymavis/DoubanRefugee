# Local Testing

## Web App

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. Import demo data, pasted Douban HTML, or JSON from
the extension. Export each destination file from the browser.

## Extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable Developer Mode.
4. Click "Load unpacked".
5. Select the repository's `extension` folder.
6. Open a Douban subject, collection, or list page.
7. Click the DoubanRefugee extension icon.
8. Click "Extract page".
9. Download or copy JSON.
10. Import that JSON in the web app.

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
