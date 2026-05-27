# DoubanRefugee Mobile

Expo React Native client for iOS and Android. It connects to the existing
FastAPI backend and supports:

- Demo import with verified public Douban subject IDs.
- Pasted Douban HTML import for movie, book, or music records.
- Canonical library viewing.
- Matching requests and Letterboxd/archive exports.

## Run Locally

Start the backend first from `backend/`, then:

```bash
cd mobile
npm ci
npm run android
```

For the iOS simulator on macOS:

```bash
npm run ios
```

API defaults:

- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`

For a physical Android device, enter the backend's reachable LAN URL in the
Connection panel. For a physical iOS device, use an HTTPS tunnel URL unless you
configure an additional App Transport Security exception.

## Builds

The Expo configuration defines Android and iOS app identifiers and includes EAS
profiles in `eas.json`. App-store or device-installable cloud builds require an
Expo account; iOS distribution also requires Apple signing credentials.

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```
