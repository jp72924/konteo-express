# Backend Integration

RetailOps Kiosk is a frontend-only PWA. It requires a running RetailOps Backend
that exposes the `/api/v1/kiosk/` API.

Backend repository:

```text
https://github.com/jp72924/retailops
```

## Start The Backend

For a local backend:

```bash
git clone https://github.com/jp72924/retailops.git
cd retailops
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py bootstrap_local --seed
python manage.py runserver
```

Backend URL:

```text
http://127.0.0.1:8000
```

## Provision A Kiosk Station

From the backend repository:

```bash
python manage.py provision_kiosk --store DEV-LOCAL --station 1 --by admin@retailops.local
```

The command prints a raw station key. Put that value in:

```js
KIOSK_API_KEY: "<printed-key>"
```

inside `config.local.js`.

## Configure CORS

The backend must allow the kiosk origin.

For a local kiosk on port 8080:

```bash
export KIOSK_CORS_ORIGINS=http://127.0.0.1:8080,http://localhost:8080
```

For the native (Capacitor) iOS/Android apps, also allow the native WebView
origin, and use an HTTPS backend (the native origin is a secure context, so an
http:// backend is blocked as mixed content):

```bash
export KIOSK_CORS_ORIGINS=https://kiosk.tienda.com,capacitor://localhost
```

Then restart the backend.

## Kiosk API Flow

The kiosk uses the `Authorization: KioskKey <key>` header for every request.

Main endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/kiosk/heartbeat/` | Validate station key at startup. |
| `POST` | `/api/v1/kiosk/identify/` | Look up customer by national ID. |
| `POST` | `/api/v1/kiosk/register/` | Register a kiosk customer. |
| `GET` | `/api/v1/kiosk/products/` | Search active products. |
| `GET` | `/api/v1/kiosk/products/{id}/` | Fetch product details. |
| `POST` | `/api/v1/kiosk/checkout/` | Atomic checkout and payment. |

## Separation Of Responsibilities

RetailOps Kiosk:

- renders the customer-facing UI;
- stores only session UI state in the browser;
- sends checkout requests to the backend.

RetailOps Backend:

- owns customers, products, orders, inventory, payments, settings, and station keys;
- validates stock and payment receipts;
- writes to the database and media storage.

The kiosk never connects directly to the database, PostgreSQL, Cloud SQL, GCS,
S3, RustFS, Garage, or local backend media storage.
