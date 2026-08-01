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
import { esc, kioskHeader, icon } from './utils.js';
import { _progressSteps } from './HomeScreen.js';
import { fetchRecipientProfiles } from '../services/recipients.js';
import { notify } from '../notify.js';

/** Display map: RetailOps payment_method value → { label, desc, icon } */
const PAYMENT_DISPLAY = {
  cash:           { label: 'Efectivo',                 desc: 'Billetes y monedas',            icon: 'cash' },
  mobile_payment: { label: 'Pago movil',               desc: 'BDV, Mercantil, BBVA...',       icon: 'phone' },
  bank_transfer:  { label: 'Transferencia bancaria',   desc: 'Desde tu app bancaria',         icon: 'bank' },
  card:           { label: 'Tarjeta debito / credito', desc: 'Visa, Mastercard, AmEx',        icon: 'card' },
  check:          { label: 'Cheque',                   desc: 'Cheque a nombre de la empresa', icon: 'document' },
  other:          { label: 'Otro metodo',              desc: 'Consulta en caja',              icon: 'swap' },
};

const RECEIPT_METHODS = ['mobile_payment', 'bank_transfer'];

export const PaymentScreen = {
  /** @type {string} */
  _selected: '',
  /** @type {(() => void) | null} Unsubscribe for exchange_rate_unavailable */
  _rateUnsub: null,
  /** @type {AbortController | null} */
  _recipientAbort: null,
  /**
   * Resolves to { mobile_payment, bank_transfer } (each a profile object or
   * null) once the recipient-profiles prefetch settles. Never rejects except
   * on abort — the confirm handler awaits this directly instead of reading a
   * possibly-still-pending store value, so it always sees the real result.
   * @type {Promise<{mobile_payment: object|null, bank_transfer: object|null}> | null}
   */
  _recipientPromise: null,

  mount(container, _params = {}) {
    this._rateUnsub = null;
    // Default to first enabled method
    this._selected = CONFIG.ENABLED_PAYMENT_METHODS[0];

    const cart           = store.get('cart') ?? [];
    const total          = cart.reduce((s, item) => s + Number(item.unit_price) * item.qty, 0);
    const hasLowStock    = cart.some(item => item.is_low_stock);
    const rateUnavailable = store.get('exchange_rate_unavailable') ?? false;

    const methodCards = CONFIG.ENABLED_PAYMENT_METHODS.map(method => {
      const d   = PAYMENT_DISPLAY[method] ?? { label: method, desc: '', icon: 'swap' };
      const sel = method === this._selected ? ' selected' : '';
      return `
        <div class="payment-option${sel}" data-method="${esc(method)}">
          <div class="payment-option-icon">${icon(d.icon)}</div>
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
              <span class="low-stock-banner-icon">${icon('warning')}</span>
              <span>Tipo de cambio no disponible. Los precios pueden no ser exactos.</span>
            </div>
          </div>

          <div class="section-label">Forma de pago</div>

          <div id="payment-methods" style="display:flex;flex-direction:column;gap:10px">
            ${methodCards}
          </div>

          ${hasLowStock ? `
          <div class="low-stock-banner">
            <span class="low-stock-banner-icon">${icon('warning')}</span>
            <span>Tu carrito contiene productos con <strong>existencias limitadas</strong>. Confirma pronto para asegurar tu compra.</span>
          </div>` : ''}

          <div class="alert-box">
            <div class="alert-icon">${icon('lock')}</div>
            <div class="alert-text">
              Pago 100% seguro. Ningún empleado manipula tu información de pago.
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <button class="btn-primary" id="btn-confirm">Confirmar y pagar ${icon('forward')}</button>
        </div>
      </div>
    `;

    const self = this;

    // Method selection
    container.querySelectorAll('.payment-option').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        self._selected = card.dataset.method;
        container.querySelectorAll('.payment-option').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Confirm
    const confirmBtn = container.querySelector('#btn-confirm');
    confirmBtn.addEventListener('click', async () => {
      const needsReceipt = RECEIPT_METHODS.includes(self._selected);
      const enabledMethods = store.get('ocr_enabled_methods') ?? [];
      const ocrAvailable = Boolean(
        store.get('ocr_enabled') && enabledMethods.includes(self._selected)
      );

      if (needsReceipt) {
        // The visual disabling below is only the first line of defense (it
        // can lag the fetch, or miss a race). This await is the authoritative
        // guarantee: never navigate to a destination we haven't confirmed
        // exists, per KIOSK_INTEGRATION.md's "never fall back to a hardcoded
        // destination" guidance.
        confirmBtn.disabled = true;
        const originalLabel = confirmBtn.innerHTML;
        confirmBtn.textContent = 'Verificando…';
        const profiles = await self._recipientPromise;
        if (profiles[self._selected] == null) {
          notify('Este método de pago no está disponible en este momento.', 'error');
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalLabel;
          return;
        }
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalLabel;
      }

      navigate(needsReceipt ? 'payment-account' : 'processing', {
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

    // Prefetch the primary recipient profile for each receipt method so the
    // account-details screen never has to fetch on its own, and so unconfigured
    // methods can be greyed out here before the customer picks a dead end.
    // Fired once per mount, never polled (KIOSK_INTEGRATION.md:132-134).
    this._recipientAbort = new AbortController();
    this._recipientPromise = fetchRecipientProfiles(this._recipientAbort.signal)
      .then(map => {
        store.set('recipient_profiles', map);
        self._applyAvailability(container, map);
        return map;
      })
      .catch(err => {
        if (err.name === 'AbortError') return { mobile_payment: null, bank_transfer: null };
        // Fetch failed outright — treat exactly like "nothing configured"
        // rather than silently leaving receipt methods selectable with an
        // unverified destination.
        const empty = { mobile_payment: null, bank_transfer: null };
        store.set('recipient_profiles', empty);
        self._applyAvailability(container, empty);
        return empty;
      });
  },

  /**
   * Grey out any receipt-method card with no configured primary profile, and
   * reselect if the card that just became disabled was the active selection.
   * @param {HTMLElement} container
   * @param {{mobile_payment: object|null, bank_transfer: object|null}} map
   */
  _applyAvailability(container, map) {
    if (!container.querySelector('#btn-confirm')) return; // screen unmounted

    let needsReselect = false;
    RECEIPT_METHODS.forEach(method => {
      if (map[method] != null) return;
      const card = container.querySelector(`.payment-option[data-method="${method}"]`);
      if (!card || card.classList.contains('disabled')) return;
      card.classList.add('disabled');
      const badge = document.createElement('div');
      badge.className = 'payment-option-unavailable';
      badge.textContent = 'No disponible';
      card.querySelector('.payment-option-desc')?.after(badge);
      if (this._selected === method) needsReselect = true;
    });

    if (!needsReselect) return;

    const nextMethod = CONFIG.ENABLED_PAYMENT_METHODS.find(
      m => !RECEIPT_METHODS.includes(m) || map[m] != null,
    );
    if (!nextMethod) return; // every configured method is unavailable

    this._selected = nextMethod;
    container.querySelectorAll('.payment-option').forEach(c => {
      c.classList.toggle('selected', c.dataset.method === nextMethod);
    });
  },

  unmount() {
    this._rateUnsub?.();
    this._rateUnsub = null;
    this._recipientAbort?.abort();
    this._recipientAbort = null;
    this._recipientPromise = null;
    this._selected  = '';
  },
};

function _header() {
  return kioskHeader({ actionLabel: 'Volver', actionId: 'back-btn' });
}
