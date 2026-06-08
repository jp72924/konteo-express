# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

RetailOps Kiosk is a standalone self-checkout PWA for the RetailOps Backend
(`https://github.com/jp72924/retailops`). It is **static HTML + CSS + vanilla
ES modules — no build step, no bundler, no npm**. The backend is a separate
repo; the kiosk never touches a database, object storage, or media directly.

## Commands

Serve locally (must be over HTTP — `file://` breaks ES modules and the service worker):

```bash
cp config.example.js config.local.js   # then edit BASE_URL + KIOSK_API_KEY
python3 -m http.server 8080            # open http://127.0.0.1:8080/
```

Syntax + hygiene checks (this is the whole CI; there is no test runner):

```bash
bash scripts/check-kiosk.sh   # node --check on all JS + checks no real key committed
```

Check a single file: `node --check app/components/ScanScreen.js`

CI (`.github/workflows/ci.yml`) runs `bash -n` on shell scripts, `check-kiosk.sh`,
and asserts `config.local.js` is absent and `<KIOSK_API_KEY>` placeholder is intact.

## Configuration Model

Per-store config is **not** code. It lives in a `window.__KIOSK_CONFIG__` block
inline in `index.html` (safe defaults / placeholders, committed) overridden by an
untracked `config.local.js` for real stations. `config.js` reads that global,
validates required fields, and exports a frozen `CONFIG` plus `CONFIG_ERRORS`
(collected, not thrown — `main.js` renders them as a startup error screen).
Never commit `config.local.js` or a real `KIOSK_API_KEY`.

A station is provisioned backend-side: `python manage.py provision_kiosk --store X --station 1`.

## Architecture

**Bootstrap** (`app/main.js`): validates config → `initialLogin()` (pings
`POST /kiosk/heartbeat/` to validate the key) → `applySettings()` → navigates to
`home`. Also owns the idle timer (resets session to home after `IDLE_TIMEOUT_SECONDS`)
and a global error boundary (`window.onerror` / `unhandledrejection`) that shows a
"tap to restart" recovery overlay instead of leaving a blank screen.

**Navigation**: screens are plain objects with `mount(el, params)` / `unmount()`,
registered in the `SCREENS` map in `main.js`. To avoid circular imports, components
call `navigate()` from `app/router.js`, whose implementation `main.js` injects via
`setNavigate()` at bootstrap. There is no URL routing.

**State** (`app/store.js`): a tiny pub/sub singleton. Keys in `PERSISTED_KEYS`
(customer, order, cart, payment) auto-sync to `sessionStorage` so a refresh restores
the in-progress checkout. `clearSession()` resets a transaction. The API key lives in
`CONFIG`, never in storage.

**API layer** (`app/api.js`): all fetch goes through `_request`. Attaches
`Authorization: KioskKey <key>`, fast-fails offline, maps RetailOps error codes to
Spanish messages via `_codeToSpanish`, throws structured `ApiError`. Auth is a static
per-station key — **no token exchange, no retry**; 401/403 means the station was
deactivated (terminal). `app/services/*` are thin wrappers over `api.*` (one file per
domain: auth, customer, orders, products, payments, settings).

**Checkout** is atomic: `services/orders.js` posts the whole cart to a single
`POST /kiosk/checkout/` that validates stock, records payment, and marks DELIVERED in
one backend transaction. Don't reintroduce a multi-step create/confirm/pay flow.

**Theme/currency**: `config.js` validates theme colors (`_isSafeCssColor`), `theme.js`
maps them to `--ft-*` CSS custom properties. `currency.js` boots with the static
`USD_TO_BS_RATE` then `applySettings()` overrides symbol/decimals/rate from backend
`/settings/`. UI copy is Spanish (`es-VE`).

**Service worker** (`sw.js`): HTML = network-first (avoids blank-screen from stale
shell), other same-origin assets = cache-first, cross-origin API (different port) not
intercepted. When changing any cached asset, bump `CACHE_VERSION` in `sw.js` (and
`APP_VERSION` in public config when the public default changes).

## Native App Wrapper (Capacitor)

The same static app also ships as native iOS/Android apps via Capacitor (see
`CAPACITOR.md`). The **web app stays dependency-free** — Capacitor is a separate
build target (`package.json`, `capacitor.config.json`, `scripts/build-www.mjs`,
committed `android/` + `ios/` projects). `npm run copy` assembles `./www` and
runs `cap copy`. Per-station config is provisioned **at runtime** on native via
`SettingsScreen` + `app/native-config.js` (saved to localStorage as
`kiosk_native_config`), so no Kiosk key is baked into the binary. `main.js`
routes to `settings` when `window.__IS_NATIVE__` and config is invalid. Native
requires an HTTPS backend (`capacitor://localhost` is a secure origin); add
`capacitor://localhost` to backend CORS.

## Conventions

- Web app stays dependency-free; no bundler, no framework. (npm/native toolchains
  are only for the Capacitor wrapper, never for running the kiosk in a browser.)
- Backend/API behavior belongs in the RetailOps Backend repo, not here — this repo is
  UI only.
- New screen = component object with `mount`/`unmount` + entry in the `SCREENS` map.
- Mobile install: PNG icons in `icons/` (any + maskable + apple-touch). When changing
  cached assets bump `CACHE_VERSION` in `sw.js` + `APP_VERSION` in index.html.
