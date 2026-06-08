/**
 * services/products.js — product search and retrieval.
 *
 * Wraps the RetailOps Kiosk API for use on the scan/cart screen.
 * All calls go through /api/v1/kiosk/products/ which accepts KioskKey auth.
 */

import { api } from '../api.js';

/**
 * Search active products by name or SKU.
 * Returns up to 6 results for the preview list.
 *
 * @param {string}       query   Search term (minimum 2 characters recommended)
 * @param {AbortSignal}  [signal] Optional signal to cancel the request
 * @returns {Promise<object[]>} Array of product objects
 */
export async function searchProducts(query, signal) {
  const params = new URLSearchParams({ search: query });
  const data = await api.get(`/kiosk/products/?${params}`, { signal });
  return data.results ?? [];
}

/**
 * Fetch a single product by ID (used for stock re-validation before checkout).
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function getProduct(id) {
  return api.get(`/kiosk/products/${id}/`);
}
