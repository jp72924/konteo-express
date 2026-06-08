# Contributing

RetailOps Kiosk is intentionally small: static HTML, CSS, and browser-native
JavaScript modules. There is no build step.

## Local Setup

```bash
git clone https://github.com/jp72924/retailops-kiosk.git
cd retailops-kiosk
cp config.example.js config.local.js
python3 -m http.server 8080
```

Open:

```text
http://127.0.0.1:8080/
```

## Checks

Run JavaScript syntax checks:

```bash
bash scripts/check-kiosk.sh
```

Or manually:

```bash
node --check app/*.js
node --check app/services/*.js
node --check app/components/*.js
node --check sw.js
```

## Development Notes

- Do not commit `config.local.js`.
- Do not commit real station API keys.
- Keep the app dependency-free unless there is a strong reason.
- Keep customer-facing copy short and clear; the UI is for unattended checkout.
- Kiosk API behavior belongs in the RetailOps Backend repo.
- Kiosk UI behavior belongs here.

## Release Notes

When changing any cached asset, update:

- `APP_VERSION` in public config examples when the public default changes;
- `CACHE_VERSION` in `sw.js`.
