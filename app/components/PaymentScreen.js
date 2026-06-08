/**
 * PaymentScreen.js — Payment method selection (Step 5 of 5).
 *
 * Renders one card per value in CONFIG.ENABLED_PAYMENT_METHODS.
 * On "Confirmar y pagar" navigates to ProcessingScreen with the selected method.
 */

import { CONFIG }   from '../config.js';
import { store }    from '../store.js';
import { navigate } from '../router.js';
import { formatDual } from '../currency.js';
import { esc, kioskHeader } from './utils.js';
import { _progressSteps } from './HomeScreen.js';

/** Display map: RetailOps payment_method value → { label, desc, icon } */
const PAYMENT_DISPLAY = {
  cash:           { label: 'Efectivo',                 desc: 'Billetes y monedas',            icon: '💵' },
  mobile_payment: { label: 'Pago movil',               desc: 'BDV, Mercantil, BBVA...',       icon: '📱' },
  bank_transfer:  { label: 'Transferencia bancaria',   desc: 'Desde tu app bancaria',         icon: '🏦' },
  card:           { label: 'Tarjeta debito / credito', desc: 'Visa, Mastercard, AmEx',        icon: '💳' },
  check:          { label: 'Cheque',                   desc: 'Cheque a nombre de la empresa', icon: '📄' },
  other:          { label: 'Otro metodo',              desc: 'Consulta en caja',              icon: '💱' },
};

const RECEIPT_METHODS = ['mobile_payment', 'bank_transfer'];

export const PaymentScreen = {
  /** @type {string} */
  _selected: '',
  /** @type {(() => void) | null} Unsubscribe for exchange_rate_unavailable */
  _rateUnsub: null,

  mount(container, _params = {}) {
    this._rateUnsub = null;
    // Default to first enabled method
    this._selected = CONFIG.ENABLED_PAYMENT_METHODS[0];

    const cart           = store.get('cart') ?? [];
    const total          = cart.reduce((s, item) => s + Number(item.unit_price) * item.qty, 0);
    const hasLowStock    = cart.some(item => item.is_low_stock);
    const rateUnavailable = store.get('exchange_rate_unavailable') ?? false;

    const methodCards = CONFIG.ENABLED_PAYMENT_METHODS.map(method => {
      const d   = PAYMENT_DISPLAY[method] ?? { label: method, desc: '', icon: '💱' };
      const sel = method === this._selected ? ' selected' : '';
      return `
        <div class="payment-option${sel}" data-method="${esc(method)}">
          <div class="payment-option-icon">${d.icon}</div>
          <div>
            <div class="payment-option-label">${esc(d.label)}</div>
            <div class="payment-option-desc">${esc(d.desc)}</div>
          </div>
          <div class="pay-check"><span class="pay-checkmark">✓</span></div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="kiosk-body">
          ${_progressSteps(5)}

          <div class="text-center">
            <div class="screen-title" style="font-size:16px">Método de pago</div>
            <div class="screen-sub">Selecciona cómo deseas pagar</div>
          </div>

          <div class="cart-summary">
            <div class="summary-row total">
              <span>Total a pagar</span>
              <span id="total-display">${formatDual(total)}</span>
            </div>
          </div>

          <div id="rate-warning" style="${rateUnavailable ? '' : 'display:none'}">
            <div class="low-stock-banner">
              <span class="low-stock-banner-icon">⚠️</span>
              <span>Tipo de cambio no disponible. Los precios pueden no ser exactos.</span>
            </div>
          </div>

          <div class="section-label">Forma de pago</div>

          <div id="payment-methods" style="display:flex;flex-direction:column;gap:10px">
            ${methodCards}
          </div>

          ${hasLowStock ? `
          <div class="low-stock-banner">
            <span class="low-stock-banner-icon">⚠️</span>
            <span>Tu carrito contiene productos con <strong>existencias limitadas</strong>. Confirma pronto para asegurar tu compra.</span>
          </div>` : ''}

          <div class="alert-box">
            <div class="alert-icon">🔒</div>
            <div class="alert-text">
              Pago 100% seguro. Ningún empleado manipula tu información de pago.
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <button class="btn-primary" id="btn-confirm">Confirmar y pagar →</button>
        </div>
      </div>
    `;

    const self = this;

    // Method selection
    container.querySelectorAll('.payment-option').forEach(card => {
      card.addEventListener('click', () => {
        self._selected = card.dataset.method;
        container.querySelectorAll('.payment-option').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Confirm
    container.querySelector('#btn-confirm').addEventListener('click', () => {
      const needsReceipt = RECEIPT_METHODS.includes(self._selected);
      const enabledMethods = store.get('ocr_enabled_methods') ?? [];
      const ocrAvailable = Boolean(
        store.get('ocr_enabled') && enabledMethods.includes(self._selected)
      );

      navigate(needsReceipt ? 'pago-movil-form' : 'processing', {
        paymentMethod: self._selected,
        totalUsd:      total,
        ocrAvailable,
      });
    });

    // Back
    container.querySelector('#back-btn')?.addEventListener('click', () => {
      navigate('scan');
    });

    // Subscribe to exchange rate availability — updates banner if a background
    // refresh completes (or fails) while this screen is open.
    const rateWarningEl = container.querySelector('#rate-warning');
    this._rateUnsub = store.on('exchange_rate_unavailable', (unavailable) => {
      if (rateWarningEl) rateWarningEl.style.display = unavailable ? '' : 'none';
    });
  },

  unmount() {
    this._rateUnsub?.();
    this._rateUnsub = null;
    this._selected  = '';
  },
};

function _header() {
  return kioskHeader({ actionLabel: '\u2190 Volver', actionId: 'back-btn' });
}
