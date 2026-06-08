/**
 * services/customer.js — customer lookup and registration.
 *
 * Uses the dedicated kiosk endpoints:
 *   POST /kiosk/identify/  — look up customer by national_id
 *   POST /kiosk/register/  — register a new kiosk customer
 *
 * The national_id is the numeric portion of the Cédula (digits only) combined
 * with its prefix (e.g. "V12345678"). The server stores it in a dedicated
 * indexed field — no email derivation, no PII in notes.
 */

import { api } from '../api.js';

/**
 * Format a Cédula for display (e.g. "V-12345678").
 * @param {string} prefix  'V', 'E', or 'P'
 * @param {string} number  Numeric part of the Cédula (digits only)
 * @returns {string}
 */
export function formatCedula(prefix, number) {
  return `${prefix}-${number}`;
}

/**
 * Build the national_id value sent to the server from prefix + digits.
 * @param {string} prefix
 * @param {string} number
 * @returns {string}  e.g. "V12345678"
 */
export function buildNationalId(prefix, number) {
  return `${prefix}${number}`;
}

/**
 * Look up an existing customer by Cédula via POST /kiosk/identify/.
 * Returns the customer object on success, null if not found.
 *
 * @param {string} prefix
 * @param {string} number
 * @returns {Promise<{customer_id: number, first_name: string, last_name: string} | null>}
 */
export async function findCustomer(prefix, number) {
  try {
    return await api.post('/kiosk/identify/', {
      national_id: buildNationalId(prefix, number),
    });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Register a new kiosk customer via POST /kiosk/register/.
 *
 * @param {object} form
 * @param {string} form.firstName
 * @param {string} form.lastName
 * @param {string} form.email
 * @param {string} form.phone
 * @param {string} form.dateOfBirth  ISO date string (YYYY-MM-DD)
 * @param {string} form.gender       'M' or 'F'
 * @param {string} form.state
 * @param {string} form.city
 * @param {string} prefix   Cédula prefix
 * @param {string} number   Cédula number (digits only)
 * @returns {Promise<{customer_id: number, first_name: string, last_name: string}>}
 */
export async function createCustomer(
  { firstName, lastName, email, phone, dateOfBirth, gender, state, city },
  prefix,
  number,
) {
  return api.post('/kiosk/register/', {
    national_id:   buildNationalId(prefix, number),
    first_name:    firstName,
    last_name:     lastName,
    email:         email,
    phone:         phone,
    date_of_birth: dateOfBirth,
    gender:        gender,
    state:         state,
    city:          city,
  });
}
