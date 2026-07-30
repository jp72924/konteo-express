/**
 * config.js — reads window.__KIOSK_CONFIG__ and exports a frozen copy.
 *
 * Required fields (missing ones are collected into CONFIG_ERRORS, not thrown):
 *   BASE_URL, KIOSK_API_KEY, STORE_NAME,
 *   STORE_ADDRESS, KIOSK_STATION_NUMBER, ENABLED_PAYMENT_METHODS.
 *
 * Optional fields receive sensible defaults when absent so a minimal config
 * block is sufficient for most deployments.
 *
 * Validation errors are exported as CONFIG_ERRORS so that main.js can display
 * a friendly startup error screen listing every missing field before the app
 * attempts any network call.
 *
 * No code changes are required per store — only the inline __KIOSK_CONFIG__
 * block in index.html is edited for each deployment.
 */

/**
 * Validation errors collected during config loading.
 * Empty array means the config is valid and the app may proceed.
 * @type {string[]}
 */
export const CONFIG_ERRORS = [];

if (!window.__KIOSK_CONFIG__) {
  CONFIG_ERRORS.push('El bloque __KIOSK_CONFIG__ no está presente en index.html.');
}

const _raw = window.__KIOSK_CONFIG__ ?? {};

/** True when `url` points at a loopback host (a potentially trustworthy origin). */
function _isLoopbackUrl(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

// ─── Required field validation ────────────────────────────────────────────────

const _REQUIRED = [
  'BASE_URL',
  'KIOSK_API_KEY',
  'STORE_NAME',
  'STORE_ADDRESS',
  'KIOSK_STATION_NUMBER',
];

for (const key of _REQUIRED) {
  if (_raw[key] == null || _raw[key] === '') {
    CONFIG_ERRORS.push(`Campo requerido ausente o vacío: ${key}`);
  }
}

// Detect unpopulated placeholder key so the operator gets a clear message
// instead of a confusing 401 from the server.
if (_raw.KIOSK_API_KEY && _raw.KIOSK_API_KEY.startsWith('<')) {
  CONFIG_ERRORS.push(
    'KIOSK_API_KEY contiene el valor de ejemplo. ' +
    'Reemplázalo con la clave generada por provision_kiosk.'
  );
}

if (!Array.isArray(_raw.ENABLED_PAYMENT_METHODS) || _raw.ENABLED_PAYMENT_METHODS.length === 0) {
  CONFIG_ERRORS.push('ENABLED_PAYMENT_METHODS debe ser un arreglo con al menos un método de pago.');
}

// Mixed-content guard: a secure-origin PWA (https://) cannot reach an http://
// backend — the browser blocks the request. On phones/tablets the kiosk is
// typically installed over HTTPS, so an http:// BASE_URL would silently fail
// every API call. Surface this at startup instead of leaving mute errors.
//
// Loopback is exempt: browsers treat http://localhost and http://127.0.0.1 as
// potentially trustworthy origins, so mixed-content blocking does not apply to
// them. That exemption is what makes a native debug build (origin
// https://localhost) usable against a dev backend reached over
// `adb reverse tcp:8000 tcp:8000`.
if (
  typeof location !== 'undefined' &&
  location.protocol === 'https:' &&
  /^http:\/\//i.test(String(_raw.BASE_URL ?? '')) &&
  !_isLoopbackUrl(_raw.BASE_URL)
) {
  CONFIG_ERRORS.push(
    'BASE_URL usa http:// pero el kiosco se sirve sobre https://. ' +
    'El navegador bloqueará las solicitudes (contenido mixto). ' +
    'Usa un backend con https:// o sirve el kiosco sobre http://.'
  );
}

// ─── Build config with optional field defaults ────────────────────────────────

const _DEFAULT_THEME = Object.freeze({
  primary:           '#0057A8',
  primaryLight:      '#1A72C8',
  primaryDark:       '#003D7A',
  primarySoft:       '#EEF5FF',
  primarySoftStrong: '#D6E8FF',
  accent:            '#00CFFF',
  background:        '#F4F6FA',
  surface:           '#FFFFFF',
  text:              '#1A2033',
  muted:             '#6B7280',
  success:           '#1D9E75',
  warning:           '#EF9F27',
  danger:            '#E24B4A',
  border:            'rgba(0, 87, 168, 0.15)',
  onPrimary:         '#FFFFFF',
  onPrimaryMuted:    'rgba(255,255,255,0.72)',
  onPrimarySoft:     'rgba(255,255,255,0.86)',
});

const _THEME_KEYS = Object.keys(_DEFAULT_THEME);

function _isSafeCssColor(value) {
  const color = String(value ?? '').trim();
  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*(?:0|1|0?\.\d+|\d+%))?\s*\)$/i.test(color) ||
    /^hsla?\(\s*[\d.]+(?:deg|rad|turn)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*(?:0|1|0?\.\d+|\d+%))?\s*\)$/i.test(color)
  );
}

function _normaliseTheme(rawTheme) {
  const source = rawTheme && typeof rawTheme === 'object' ? rawTheme : {};
  const theme = {};
  for (const key of _THEME_KEYS) {
    const value = source[key];
    if (value == null || value === '') {
      theme[key] = _DEFAULT_THEME[key];
      continue;
    }

    const color = String(value).trim();
    theme[key] = _isSafeCssColor(color) ? color : _DEFAULT_THEME[key];
  }
  return Object.freeze(theme);
}

function _bool(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'si', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(text)) return false;
  return fallback;
}

const _cfg = {
  // ── Network ──────────────────────────────────────────────────────────────
  BASE_URL:                   String(_raw.BASE_URL                   ?? ''),
  API_PATH:                   String(_raw.API_PATH                   ?? '/api/v1'),

  // ── Per-station API key (provisioned via provision_kiosk management command)
  KIOSK_API_KEY:              String(_raw.KIOSK_API_KEY              ?? ''),

  // ── Store identity ────────────────────────────────────────────────────────
  STORE_NAME:                 String(_raw.STORE_NAME                 ?? ''),
  STORE_ADDRESS:              String(_raw.STORE_ADDRESS              ?? ''),
  KIOSK_STATION_NUMBER:       String(_raw.KIOSK_STATION_NUMBER       ?? '1'),

  KIOSK_THEME:                _normaliseTheme(_raw.KIOSK_THEME),
  BRAND_LOGO_URL:             String(_raw.BRAND_LOGO_URL ?? _raw.LOGO_URL ?? '').trim(),
  BRAND_LOGO_ALT:             String(_raw.BRAND_LOGO_ALT ?? _raw.STORE_NAME ?? 'RetailOps Kiosk').trim(),
  BRAND_SUBTITLE:             String(_raw.BRAND_SUBTITLE ?? 'autopago').trim(),
  BRAND_SHOW_TEXT:            _bool(_raw.BRAND_SHOW_TEXT, true),

  // ── Currency ──────────────────────────────────────────────────────────────
  USD_TO_BS_RATE:             Number(_raw.USD_TO_BS_RATE)            || 1,
  EXCHANGE_RATE_API_URL:      String(_raw.EXCHANGE_RATE_API_URL      ?? ''),
  CURRENCY_SYMBOL:            String(_raw.CURRENCY_SYMBOL            ?? 'Bs.'),
  DECIMAL_PLACES:             Number(_raw.DECIMAL_PLACES)            >= 0
                                ? Number(_raw.DECIMAL_PLACES)
                                : 2,

  // ── Inventory ─────────────────────────────────────────────────────────────
  LOW_STOCK_THRESHOLD:        Number(_raw.LOW_STOCK_THRESHOLD)       || 5,

  // ── Payment ───────────────────────────────────────────────────────────────
  ENABLED_PAYMENT_METHODS:    Array.isArray(_raw.ENABLED_PAYMENT_METHODS)
                                ? _raw.ENABLED_PAYMENT_METHODS
                                : [],

  // ── Localisation ──────────────────────────────────────────────────────────
  LOCALE:                     String(_raw.LOCALE                     ?? 'es-VE'),

  // ── Session behaviour ─────────────────────────────────────────────────────
  IDLE_TIMEOUT_SECONDS:       Number(_raw.IDLE_TIMEOUT_SECONDS)       || 120,
  PROCESSING_TIMEOUT_SECONDS: Number(_raw.PROCESSING_TIMEOUT_SECONDS) || 60,

  // ── Extension points ──────────────────────────────────────────────────────
  /** Set to true to activate the hidden barcode scanner input on ScanScreen. */
  BARCODE_ENABLED:            Boolean(_raw.BARCODE_ENABLED           ?? false),

  // ── Versioning ────────────────────────────────────────────────────────────
  APP_VERSION:                String(_raw.APP_VERSION                ?? '1.0.0'),
};

/** @type {Readonly<typeof _cfg>} */
export const CONFIG = Object.freeze(_cfg);
