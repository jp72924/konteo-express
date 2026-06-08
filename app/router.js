/**
 * router.js — navigation singleton.
 *
 * Avoids circular imports by decoupling the navigate() call from its
 * implementation. Screen components import { navigate } from '../router.js'
 * and call it freely. main.js wires in the actual implementation via
 * setNavigate() during bootstrap.
 */

/** @type {((screenId: string, params?: object) => void) | null} */
let _navigate = null;

/**
 * Called once by main.js to register the navigate implementation.
 * @param {(screenId: string, params?: object) => void} fn
 */
export function setNavigate(fn) {
  _navigate = fn;
}

/**
 * Navigate to a screen.
 * @param {string} screenId
 * @param {object} [params]
 */
export function navigate(screenId, params = {}) {
  if (!_navigate) throw new Error('Router not initialized. Call setNavigate() first.');
  _navigate(screenId, params);
}
