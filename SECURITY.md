# Security

RetailOps Kiosk is a browser frontend. It does not own sensitive backend data,
but it does contain a per-station API key at deployment time.

## Report A Vulnerability

Open a private security report on GitHub or contact the repository maintainer.
Do not publish exploitable details in a public issue before a fix is available.

## Station API Keys

`KIOSK_API_KEY` is a credential.

- Store it only in `config.local.js` or an equivalent deployment-secret path.
- Never commit it.
- Rotate it if it is exposed.
- Disable the station in RetailOps Backend if a kiosk is lost or compromised.

## Browser Storage

The kiosk stores temporary session state in browser storage. It does not store
database credentials, backend admin tokens, or object-storage credentials.

## Network Security

Use HTTPS for production deployments. A local HTTP origin is acceptable for
development or an isolated trusted LAN, but production kiosks should be served
behind TLS.

## Backend Boundary

All authoritative validation happens in RetailOps Backend. Do not trust kiosk
client-side validation for stock, payment, receipt, customer, or order rules.
