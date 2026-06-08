/**
 * CedulaScreen.js — Cédula entry screen (Step 2 of 5).
 *
 * Shows a numeric keypad and prefix selector (V / E / P).
 * On OK: looks up the customer by derived email and navigates to RegistroScreen.
 */

import { navigate }     from '../router.js';
import { notify }       from '../notify.js';
import { findCustomer, formatCedula } from '../services/customer.js';
import { esc, kioskHeader } from './utils.js';
import { _progressSteps } from './HomeScreen.js';

export const CedulaScreen = {
  /** @type {string} */
  _prefix: 'V',
  /** @type {string} */
  _digits: '',
  /** @type {boolean} */
  _loading: false,

  mount(container, _params = {}) {
    this._prefix  = 'V';
    this._digits  = '';
    this._loading = false;

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="kiosk-body">
          ${_progressSteps(2)}

          <div class="text-center">
            <div class="screen-title">Identificación</div>
            <div class="screen-sub">Ingresa tu número de cédula</div>
          </div>

          <div class="cedula-display">
            <div class="cedula-label">Cédula de identidad</div>
            <div class="cedula-value" id="cedula-val">_ _ _ _ _ _ _ _</div>
          </div>

          <div class="cedula-type-btns">
            <div class="cedula-type-btn selected" data-prefix="V">V</div>
            <div class="cedula-type-btn"           data-prefix="E">E</div>
            <div class="cedula-type-btn"           data-prefix="P">P</div>
          </div>

          <div class="num-pad">
            <div class="num-key" data-digit="1">1</div>
            <div class="num-key" data-digit="2">2</div>
            <div class="num-key" data-digit="3">3</div>
            <div class="num-key" data-digit="4">4</div>
            <div class="num-key" data-digit="5">5</div>
            <div class="num-key" data-digit="6">6</div>
            <div class="num-key" data-digit="7">7</div>
            <div class="num-key" data-digit="8">8</div>
            <div class="num-key" data-digit="9">9</div>
            <div class="num-key del" id="key-del">⌫ Borrar</div>
            <div class="num-key" data-digit="0">0</div>
            <div class="num-key ok" id="key-ok">OK ✓</div>
          </div>

          <div class="text-muted">Tus datos se usan solo para identificación</div>
        </div>
      </div>
    `;

    // ── Wire up events ──────────────────────────────────────────────
    const self = this;

    // Cancel button
    container.querySelector('#cancel-btn')?.addEventListener('click', () => {
      navigate('home');
    });

    // Prefix buttons
    container.querySelectorAll('.cedula-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        self._prefix = btn.dataset.prefix;
        container.querySelectorAll('.cedula-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        self._render(container);
      });
    });

    // Digit keys
    container.querySelectorAll('.num-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => {
        if (self._loading) return;
        if (self._digits.length < 9) {
          self._digits += key.dataset.digit;
          self._render(container);
        }
      });
    });

    // Delete key
    container.querySelector('#key-del').addEventListener('click', () => {
      if (self._loading) return;
      self._digits = self._digits.slice(0, -1);
      self._render(container);
    });

    // OK key
    container.querySelector('#key-ok').addEventListener('click', () => {
      self._confirm(container);
    });
  },

  unmount() {
    this._loading = false;
  },

  _render(container) {
    const val = container.querySelector('#cedula-val');
    if (!val) return;
    const display = this._digits
      ? `${this._prefix}-${this._digits}`
      : '_ _ _ _ _ _ _ _';
    val.textContent = display;
  },

  async _confirm(container) {
    if (this._loading) return;
    if (this._digits.length < 6) {
      notify('Ingresa al menos 6 dígitos.', 'warning');
      return;
    }

    this._loading = true;
    const okBtn = container.querySelector('#key-ok');
    if (okBtn) { okBtn.textContent = '…'; okBtn.style.opacity = '0.6'; }

    try {
      const customer = await findCustomer(this._prefix, this._digits);
      // customer is { customer_id, first_name, last_name } or null (not found)
      navigate('registro', {
        prefix:   this._prefix,
        number:   this._digits,
        isNew:    !customer,
        customer: customer ?? null,
      });
    } catch (err) {
      notify(err.message || 'Error al buscar. Intenta nuevamente.', 'error');
    } finally {
      this._loading = false;
      if (okBtn) { okBtn.textContent = 'OK ✓'; okBtn.style.opacity = ''; }
    }
  },
};

function _header() {
  return kioskHeader({ actionLabel: '\u2715 Cancelar', actionId: 'cancel-btn' });
}
