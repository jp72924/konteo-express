/**
 * services/orders.js — atomic kiosk checkout.
 *
 * v2 replaces the 6-step sequential flow (create → submit → confirm → pay →
 * ship → deliver) with a single atomic endpoint that does all of this server-
 * side inside one database transaction with row-level stock locking.  Orders
 * are immediately DELIVERED, while receipt-backed methods can include
 * receipt metadata for later review.
 */

import { api } from '../api.js';

/**
 * Execute an atomic checkout.
 *
 * The server validates stock, creates the order, deducts inventory, records
 * the payment, and marks the order DELIVERED — all in a single transaction.
 *
 * @param {number|string}              customerId       RetailOps Customer ID
 * @param {Array<{sku, qty}>}          cartItems        Cart items from store
 * @param {string}                     paymentReference Opaque payment reference
 * @param {AbortSignal}                [signal]
 * @param {{paymentMethod?: string, receipt?: object}} [payment]
 * @returns {Promise<{
 *   order_id:       number,
 *   order_number:   string,
 *   payment_number: string,
 *   total_amount:   string,
 *   payment_status: string,
 *   receipt:        object,
 * }>}
 */
export async function atomicCheckout(customerId, cartItems, paymentReference, signal, payment = {}) {
  const body = {
    customer_id:       Number(customerId),
    items:             cartItems.map(item => ({ sku: item.sku, quantity: item.qty })),
    payment_reference: paymentReference,
    payment_method:    payment.paymentMethod,
  };

  // `receipt` is optional but NOT nullable server-side: the checkout serializer
  // declares it `required=False` without `allow_null`, so sending an explicit
  // `null` fails validation with {"receipt": ["This field may not be null."]}.
  // Card/cash/check have no receipt, so the key must be omitted entirely
  // rather than sent as null.
  if (payment.receipt) body.receipt = payment.receipt;

  return api.post('/kiosk/checkout/', body, { signal });
}
