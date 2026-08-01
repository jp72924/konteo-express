/**
 * services/recipients.js — store receiving-account lookup for kiosk payments.
 *
 * Wraps GET /api/v1/kiosk/recipient-profiles/, which returns the admin-
 * designated *primary* RecipientProfile for each receipt-based payment
 * method (mobile_payment / bank_transfer) — the same allowlist checkout's
 * OCR match validates receipts against, so the destination shown to the
 * customer can never drift from what checkout will actually accept.
 *
 * Rate-limited per station (kiosk_scan, 120/min) and not meant to be
 * polled — call once per PaymentScreen visit, not on a timer.
 *
 * Unlike services/settings.js, this module does not swallow errors or write
 * to the store itself: callers need to distinguish "fetch failed" from
 * "fetch succeeded with no configured profile," so failures propagate.
 */

import { api } from '../api.js';

/**
 * Fetch the primary recipient profile for each receipt payment method.
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<{mobile_payment: object|null, bank_transfer: object|null}>}
 *   Each value is the raw profile object ({ payment_method,
 *   payment_method_display, bank, phone, account_number, document_id }) or
 *   null when no active primary profile is configured for that method.
 */
export async function fetchRecipientProfiles(signal) {
  const data = await api.get('/kiosk/recipient-profiles/', { signal });
  const map = { mobile_payment: null, bank_transfer: null };
  for (const profile of data.results ?? []) {
    if (profile.payment_method in map) map[profile.payment_method] = profile;
  }
  return map;
}
