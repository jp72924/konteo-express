/**
 * HomeScreen.js — Welcome screen (Step 1 of 5).
 *
 * Offers the primary "Pagar productos" action plus a "Pedir ayuda" card.
 * Navigates to the Cédula screen on "Pagar productos".
 */

import { CONFIG }   from '../config.js';
import { navigate } from '../router.js';
import { notify }   from '../notify.js';
import { esc, kioskHeader } from './utils.js';

export const HomeScreen = {
  /** @type {HTMLElement | null} */
  _el: null,

  mount(container, _params = {}) {
    container.innerHTML = `
      <div class="screen active">
        ${kioskHeader()}

        <div class="kiosk-body">
          ${_progressSteps(1)}

          <div class="text-center">
            <div class="screen-title">¡Bienvenido!</div>
            <div class="screen-sub">¿Qué deseas hacer hoy?</div>
          </div>

          <div class="option-grid">
            <div class="option-card highlight" id="btn-shop">
              <div class="option-icon">🛒</div>
              <div class="option-label">Pagar productos</div>
              <div class="option-desc">Busca y paga</div>
            </div>
            <div class="option-card" id="btn-help">
              <div class="option-icon">🙋</div>
              <div class="option-label">Pedir ayuda</div>
              <div class="option-desc">Llamo a un asociado</div>
            </div>
          </div>

          <div class="alert-box">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-text">
              Esta caja acepta
              <strong>${esc(_methodNames())}</strong>.
              Para otros métodos de pago, usa las cajas tradicionales.
            </div>
          </div>

          <div class="mt-auto text-muted">
            Estación N° ${esc(CONFIG.KIOSK_STATION_NUMBER)} · v${esc(CONFIG.APP_VERSION)}
          </div>
        </div>
      </div>
    `;

    this._el = container;

    container.querySelector('#btn-shop').addEventListener('click', () => {
      navigate('cedula');
    });

    container.querySelector('#btn-help').addEventListener('click', () => {
      notify('Llamando a un asociado…');
    });
  },

  unmount() {
    this._el = null;
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Render the 5-step progress bar.
 * @param {number} active  1-based active step number (1–5)
 */
export function _progressSteps(active) {
  const steps = ['Inicio', 'ID', 'Datos', 'Buscar', 'Pagar'];
  const dots = steps.map((name, i) => {
    const n    = i + 1;
    const done = n < active;
    const act  = n === active;
    const cls  = done ? 'step done' : act ? 'step active' : 'step';
    const dot  = done ? '✓' : String(n);
    const line = i < steps.length - 1
      ? `<div class="step-line${done ? ' done' : ''}"></div>`
      : '';
    return `
      <div class="${cls}">
        <div class="step-dot">${dot}</div>
        <div class="step-name">${name}</div>
      </div>
      ${line}
    `;
  }).join('');

  return `<div style="display:flex;align-items:center;justify-content:center">
    <div class="progress-steps">${dots}</div>
  </div>`;
}

/** Build a human-readable payment method list for the alert box. */
function _methodNames() {
  const MAP = {
    cash:          'efectivo',
    mobile_payment: 'pago movil',
    bank_transfer: 'transferencia bancaria',
    card:          'tarjeta débito/crédito',
    check:         'cheque',
    other:         'otros métodos',
  };
  return CONFIG.ENABLED_PAYMENT_METHODS
    .map(m => MAP[m] ?? m)
    .join(', ');
}
