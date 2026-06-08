/**
 * services/payments.js — payment recording.
 *
 * Posts a single payment against an order.
 * When the total amount paid reaches the order total, the RetailOps API
 * automatically transitions the order from Confirmed → Paid.
 */

import { api }    from '../api.js';
import { CONFIG } from '../config.js';

/**
 * Record a payment for an order.
 *
 * @param {number|string} orderId         RetailOps order ID
 * @param {number|string} amount          Amount in USD (the order's total_amount)
 * @param {string}        paymentMethod   One of CONFIG.ENABLED_PAYMENT_METHODS
 * @param {AbortSignal}   [signal]
 * @returns {Promise<object>} Payment object (includes payment_number)
 */
export async function recordPayment(orderId, amount, paymentMethod, signal) {
  return api.post('/payments/', {
    sales_order:    Number(orderId),
    amount:         String(Number(amount).toFixed(2)),
    payment_method: paymentMethod,
    notes:          `Kiosk payment — RetailOps Kiosk — Estación ${CONFIG.KIOSK_STATION_NUMBER}`,
  }, { signal });
}
