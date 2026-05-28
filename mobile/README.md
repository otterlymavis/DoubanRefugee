# DoubanRefugee Mobile

Expo React Native local companion for Android and iOS.

It supports:

- Demo import with verified public Douban subject IDs.
- Pasted extension JSON or backup JSON import.
- Local device library storage.
- Letterboxd, Filmarks, Goodreads, RateYourMusic, and backup JSON exports
  through the OS share sheet.

## Run Locally

```bash
cd mobile
npm ci
npm run android
```

For the iOS simulator on macOS:

```bash
npm run ios
```

## Builds

The Expo configuration defines Android and iOS app identifiers and includes EAS
profiles in `eas.json`. iOS distribution requires Apple signing credentials.

```bash
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```
