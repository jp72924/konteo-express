# Installation

RetailOps Kiosk is a static PWA. Installation means downloading the files,
generating `config.local.js`, and serving the directory over HTTP.

## One-Command Install

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/jp72924/retailops-kiosk/main/install.sh | bash
```

The installer asks for:

- RetailOps Backend URL
- Kiosk API key
- store name
- store address
- station number

It installs files to:

```text
~/.local/share/retailops-kiosk
```

It creates a launcher at:

```text
~/.local/bin/retailops-kiosk
```

Start the kiosk:

```bash
retailops-kiosk --port 8080
```

## Non-Interactive Install

```bash
curl -fsSL https://raw.githubusercontent.com/jp72924/retailops-kiosk/main/install.sh | bash -s -- \
  --backend-url http://127.0.0.1:8000 \
  --api-key <KIOSK_API_KEY> \
  --store-name "RetailOps Kiosk" \
  --store-address "Local store" \
  --station 1
```

## Windows Install

```powershell
irm https://raw.githubusercontent.com/jp72924/retailops-kiosk/main/install.ps1 | iex
```

Or with explicit parameters:

```powershell
.\install.ps1 `
  -BackendUrl http://127.0.0.1:8000 `
  -ApiKey <KIOSK_API_KEY> `
  -StoreName "RetailOps Kiosk" `
  -StoreAddress "Local store" `
  -Station 1
```

## Install On A Phone / Tablet (PWA)

The kiosk is an installable PWA. On a mobile device:

- **Android (Chrome):** open the kiosk URL, then use the install prompt or
  menu → "Install app" / "Add to Home screen".
- **iOS (Safari):** open the kiosk URL, then Share → "Add to Home Screen".
  The app launches full-screen with no Safari chrome.

### HTTPS is required on mobile

When the kiosk is served over `https://`, the browser **blocks** requests to an
`http://` backend (mixed content). For phone/tablet installs the backend
`BASE_URL` must be `https://` (or serve the kiosk over plain `http://` on a
trusted LAN). The kiosk shows a startup configuration error if it detects an
`http://` `BASE_URL` while running on an `https://` origin.

`http://127.0.0.1:8000` is only reachable from the same machine — it will not
work from a separate phone. Use the backend's LAN/HTTPS address instead.

## Manual Developer Install

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

## Backend Prerequisite

RetailOps Backend must be running and reachable from the kiosk device.

Provision a station key from the backend:

```bash
python manage.py provision_kiosk --store <STORE_ID> --station <N> --by <admin-email>
```

Copy the printed key into `config.local.js`.

## Troubleshooting

### `retailops-kiosk: command not found`

Add `~/.local/bin` to your shell PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### The page shows a configuration error

Check `config.local.js`. The key cannot be `<KIOSK_API_KEY>`, and required
fields such as `BASE_URL`, `STORE_NAME`, and `STORE_ADDRESS` must be present.

### The page says the station is deactivated

The API key is wrong, expired, or the station was disabled in RetailOps Backend.
Provision a new station key or reactivate the station.

### API calls fail in the browser

Make sure the backend CORS setting includes the kiosk origin, for example:

```bash
export KIOSK_CORS_ORIGINS=http://127.0.0.1:8080
```
