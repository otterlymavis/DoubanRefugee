# Local Testing

This project can be tested without production infrastructure by running the
backend, frontend, mobile app, and unpacked browser extension locally.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend uses SQLite by default when `DATABASE_URL` is not set, so it can run
without Docker for local smoke tests.

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable Developer Mode.
4. Click "Load unpacked".
5. Select the repository's `extension` folder.
6. Open a Douban subject, collection, or list page.
7. Click the DoubanRefugee extension icon.
8. Confirm the API base is `http://localhost:8000`.
9. Click "Extract page", then "Import to API".

The extension saves the returned `user_id` in extension local storage, so repeat
imports update the same local test account.

## Mobile App

The Expo app targets both Android and iOS:

```bash
cd mobile
npm ci
npm run android
```

On macOS, use `npm run ios` to launch the iOS simulator. Android emulators use
`http://10.0.2.2:8000` for the local backend; iOS simulators use
`http://localhost:8000`. Physical Android devices can use a reachable LAN
backend URL. For physical iOS devices, use an HTTPS tunnel URL unless an
additional App Transport Security exception is configured.

The app imports built-in real-record fixtures or pasted Douban HTML, displays
canonical media, triggers matching, and downloads CSV/archive exports.

## Verification Commands

```bash
cd backend
.venv\Scripts\python.exe -m pytest
```

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
