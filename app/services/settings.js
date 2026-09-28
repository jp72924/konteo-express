/**
 * services/settings.js — RetailOps system settings.
 *
 * Fetches currency display settings AND the secondary-currency exchange rate
 * from GET /api/v1/settings/ and applies them to the currency formatter.
 *
 * The exchange rate is sourced from SystemSettings.secondary_exchange_rate
 * (admin-editable) so the value shown on the kiosk matches the back-office.
 *
 * Settings are read at bootstrap and again at the start of every sale
 * (`refreshSettings()`), because the backend converts a receipt at the rate
 * current when checkout begins and compares it to the cent. A terminal that
 * only read the rate at boot kept showing it across every BCV update since,
 * so a customer who paid exactly the bolívar amount on screen could still
 * have the receipt rejected.
 */

import { api }                                       from '../api.js';
import { applyDisplaySettings, applyExchangeRate }   from '../currency.js';
import { store }                                     from '../store.js';

/** @type {Promise<void> | null} The refresh currently in flight, if any. */
let _refreshing = null;

/**
 * Fetch RetailOps system settings and apply them to the currency module.
 *
 * - `currency_symbol` / `decimal_places` drive formatting.
 * - `secondary_currency_enabled` + `secondary_exchange_rate` drive the
 *   USD → local currency multiplier used by `usdToBs()` / `formatDual()`.
 *   The `store.exchange_rate_unavailable` flag is set to `true` whenever a
 *   usable rate cannot be sourced, so scan/payment screens show the
 *   "Tipo de cambio no disponible" banner.
 *
 * Failures are silently swallowed — CONFIG defaults remain in effect, and
 * the store falls back to conservative values (OCR off, rate unavailable).
 *
 * @returns {Promise<void>}
 */
export async function applySettings() {
  try {
    _apply(await api.get('/settings/'));
  } catch {
    _applyConservativeDefaults();
  }
}

/**
 * Re-read settings mid-session so a sale starts with the current rate.
 *
 * Unlike `applySettings()`, a failure keeps whatever was last applied: the
 * terminal already holds settings that worked, and one dropped request must
 * not switch OCR off or hide the rate for the rest of the day. A call made
 * while a refresh is in flight joins it, so an older response can never land
 * after a newer one.
 *
 * @returns {Promise<void>}
 */
export function refreshSettings() {
  if (!_refreshing) {
    _refreshing = api.get('/settings/')
      .then(_apply)
      .catch(() => { /* keep the last applied settings */ })
      .finally(() => { _refreshing = null; });
  }
  return _refreshing;
}

/**
 * Apply a `GET /settings/` response to the store and the currency module.
 * @param {object} s
 */
function _apply(s) {
  store.set('ocr_enabled', Boolean(s.ocr_enabled));
  store.set('ocr_enabled_methods', Array.isArray(s.ocr_enabled_methods) ? s.ocr_enabled_methods : []);
  store.set('ocr_max_file_mb', Number(s.ocr_max_file_mb) > 0 ? Number(s.ocr_max_file_mb) : 5);
  store.set(
    'receipt_image_required_for_receipt_methods',
    s.receipt_image_required_for_receipt_methods !== false,
  );
  // Drives whether screens act on the verify endpoint's non-blocking
  // `checks.recipient_match` advisory (checkout enforces it regardless).
  store.set('recipient_validation_enabled', Boolean(s.recipient_validation_enabled));

  // The kiosk renders in the secondary (local) currency, converting from the
  // USD product prices. Use the secondary fields for symbol/decimals/rate.
  if (s.secondary_currency_enabled) {
    if (s.secondary_currency_symbol && s.secondary_decimal_places != null) {
      applyDisplaySettings(s.secondary_currency_symbol, s.secondary_decimal_places);
    }
    if (Number(s.secondary_exchange_rate) > 0) {
      applyExchangeRate(Number(s.secondary_exchange_rate));
      store.set('exchange_rate_unavailable', false);
    } else {
      store.set('exchange_rate_unavailable', true);
    }
  } else {
    store.set('exchange_rate_unavailable', true);
  }
}

/** The settings a terminal runs on when it could not read any at all. */
function _applyConservativeDefaults() {
  store.set('ocr_enabled', false);
  store.set('ocr_enabled_methods', []);
  store.set('ocr_max_file_mb', 5);
  store.set('receipt_image_required_for_receipt_methods', true);
  store.set('recipient_validation_enabled', false);
  store.set('exchange_rate_unavailable', true);
}
