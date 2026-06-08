/**
 * notify.js — toast notification utility.
 *
 * Shows a brief overlay message at the top of the screen.
 * Supports four styles: default (blue), warning (amber), error (red), success (green).
 *
 * Usage:
 *   import { notify } from '../notify.js';
 *   notify('Producto agregado al carrito');
 *   notify('Últimas unidades disponibles.', 'warning');
 *   notify('Producto agotado.', 'error');
 *   notify('Registro exitoso.', 'success');
 */

/** @type {HTMLElement | null} */
let _el = null;

/** @type {number | null} */
let _timer = null;

/**
 * Wire up the toast element. Called once by main.js.
 * @param {HTMLElement} el
 */
export function initNotify(el) {
  _el = el;
}

/**
 * Show a toast message.
 * @param {string} message
 * @param {'default'|'warning'|'error'|'success'} [type='default']
 * @param {number} [duration=2600]
 */
export function notify(message, type = 'default', duration = 2600) {
  if (!_el) return;

  _el.textContent = message;
  _el.className   = 'notif show';           // reset all type modifiers, then apply
  if (type === 'warning') _el.classList.add('warning');
  if (type === 'error')   _el.classList.add('error');
  if (type === 'success') _el.classList.add('success');

  clearTimeout(_timer);
  _timer = setTimeout(() => {
    if (_el) _el.classList.remove('show');
  }, duration);
}
