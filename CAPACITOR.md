# Native App Builds (Capacitor)

RetailOps Kiosk ships as a static PWA *and* as native iOS/Android apps via
[Capacitor](https://capacitorjs.com). The web app is the single source of truth
— Capacitor only wraps it in a native shell. There is no bundler and no
framework; the `app/` ES modules run unchanged inside the native WebView.

> The "no npm, no build" rule applies to the **web app**. Capacitor is a
> separate build target: `npm` and the native toolchains are used only to
> produce the store binaries, not to run or develop the kiosk in a browser.

## Prerequisites

- Node.js + npm (for the Capacitor CLI).
- **Android:** Android Studio (SDK + Gradle).
- **iOS:** a **Mac** with Xcode and CocoaPods. iOS binaries cannot be built on
  Windows/Linux — the `ios/` project can be generated anywhere, but archiving
  requires macOS.

## One-time setup

```bash
npm install
npx cap add android   # already added if android/ exists
npx cap add ios       # already added if ios/ exists (build on Mac)
```

## Build / run loop

After any change to the web app (`app/`, `index.html`, `styles.css`, etc.):

```bash
npm run copy            # build:www → assemble ./www → cap copy
npm run open:android    # opens Android Studio → Run / build signed AAB
npm run open:ios        # opens Xcode (Mac only) → Run / archive
```

`npm run sync` also updates native plugins (`build:www && cap sync`).

`scripts/build-www.mjs` assembles `./www` from the runtime assets
(`index.html`, `app/`, `icons/`, `styles.css`, `sw.js`, `manifest.json`).
`config.local.js` is intentionally **not** bundled — see provisioning below.
`./www` is git-ignored; the `android/` and `ios/` project dirs are committed,
their generated build outputs are not.

## Per-station provisioning (no key in the binary)

A single signed binary serves every store. The per-station `BASE_URL` and
`KIOSK_API_KEY` are entered **at runtime**, not baked into the package:

- On first launch (or whenever config is invalid) the native app detects
  `window.__IS_NATIVE__` and routes to the in-app **SettingsScreen**
  (`app/components/SettingsScreen.js`) instead of the web error overlay.
- The operator enters the backend URL + provisioned Kiosk key. Values are saved
  to `localStorage` (key `kiosk_native_config`).
- `app/native-config.js` (loaded before `app/main.js`) merges those saved
  values over the bundled defaults on every load.
- Re-provision anytime from the dev console: `window.openKioskSettings()`.

This keeps the Kiosk API key out of the distributed artifact and avoids a
separate build per station.

## HTTPS / cleartext

The native WebView origin is `capacitor://localhost` (a secure context). By
default (`androidScheme: https`, `allowMixedContent: false` in
`capacitor.config.json`) the app can only reach an **HTTPS** backend. To allow a
cleartext HTTP backend on a trusted LAN you must opt in via Android
`networkSecurityConfig` / `usesCleartextTraffic` and an iOS ATS exception — not
recommended for production.

## Backend CORS

The backend must allow the native origin in addition to any web origins:

```bash
export KIOSK_CORS_ORIGINS=https://kiosk.tienda.com,capacitor://localhost
```

## Service worker

SW registration is skipped inside the native shell (`!window.__IS_NATIVE__` in
`index.html`) because Capacitor already serves the assets locally from the
bundle. The SW still runs for the browser PWA.
