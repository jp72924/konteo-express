/**
 * services/settings.js — RetailOps system settings.
 *
 * Fetches currency display settings AND the secondary-currency exchange rate
 * from GET /api/v1/settings/ and applies them to the currency formatter.
 *
 * The exchange rate is sourced from SystemSettings.secondary_exchange_rate
 * (admin-editable) so the value shown on the kiosk matches the back-office.
 */

import { api }                                       from '../api.js';
import { applyDisplaySettings, applyExchangeRate }   from '../currency.js';
import { store }                                     from '../store.js';

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
 * Failures are silently swallowed — CONFIG defaults remain in effect.
 *
 * @returns {Promise<void>}
 */
export async function applySettings() {
  try {
    const s = await api.get('/settings/');

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
  } catch {
    store.set('ocr_enabled', false);
    store.set('ocr_enabled_methods', []);
    store.set('ocr_max_file_mb', 5);
    store.set('receipt_image_required_for_receipt_methods', true);
    store.set('recipient_validation_enabled', false);
    store.set('exchange_rate_unavailable', true);
  }
}
