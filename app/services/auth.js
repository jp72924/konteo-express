/**
 * services/auth.js — kiosk startup validation.
 *
 * In v2 there is no credential exchange. The KIOSK_API_KEY in the config block
 * is a static per-station key that is attached directly to every request as an
 * Authorization: KioskKey header.
 *
 * initialLogin() now simply verifies that the station is reachable and the key
 * is accepted by hitting POST /kiosk/heartbeat/. This surfaces misconfigurations
 * (wrong URL, deactivated station, placeholder key) before the customer flow
 * begins, with the same error-handling path that was used before.
 */

import { api } from '../api.js';

/**
 * Validate the station API key by pinging the heartbeat endpoint.
 * Throws on network error or invalid/deactivated key.
 */
export async function initialLogin() {
  await api.post('/kiosk/heartbeat/');
}
