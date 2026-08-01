/**
 * PaymentAccountScreen.js — where-to-pay details for receipt-based payment
 * methods (Step 5a, between PaymentScreen and PagoMovilFormScreen).
 *
 * Shows the bank plus phone/account-number and document ID (cédula/RIF) of
 * the store's primary receiving account for the chosen payment method, so
 * the customer knows exactly where to send the money before uploading a
 * receipt. This is the same RecipientProfile data checkout's OCR match
 * validates receipts against — never a destination hardcoded in the kiosk.
 *
 * This screen never fetches on its own: PaymentScreen already prefetched
 * and cached the primary profile for each receipt method in
 * store.recipient_profiles, and its confirm handler awaits that fetch
 * before ever navigating here — so the cache is normally guaranteed
 * populated. A missing/empty entry (reachable only via an abnormal path,
 * e.g. direct navigation bypassing PaymentScreen) renders a graceful
 * "not available" state instead of a blank or broken form.
 */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { formatBs, formatDual, usdToBs } from '../currency.js';
import { esc, kioskHeader, icon } from './utils.js';
import { _progressSteps } from './HomeScreen.js';

const RECEIPT_METHODS = ['mobile_payment', 'bank_transfer'];
const METHOD_LABELS = {
  mobile_payment: 'Pago movil',
  bank_transfer: 'Transferencia bancaria',
};

/**
 * Copy affordances are only offered where the Clipboard API actually exists.
 * Every supported kiosk deployment is a secure context — an HTTPS PWA, the
 * Capacitor shell on https://localhost, or the documented 127.0.0.1 dev
 * server — so rather than carry a deprecated execCommand fallback, the
 * buttons are simply not rendered anywhere that would need one.
 */
const CLIPBOARD_AVAILABLE = Boolean(navigator.clipboard?.writeText);

const COPIED_FEEDBACK_MS = 1500;

export const PaymentAccountScreen = {
  mount(container, params = {}) {
    const cart = store.get('cart') ?? [];
    const totalUsd = Number(params.totalUsd ?? cart.reduce(
      (s, item) => s + Number(item.unit_price) * item.qty,
      0,
    ));
    const paymentMethod = RECEIPT_METHODS.includes(params.paymentMethod)
      ? params.paymentMethod
      : 'mobile_payment';
    const ocrAvailable = Boolean(params.ocrAvailable);

    const profiles = store.get('recipient_profiles');
    const profile = profiles?.[paymentMethod] ?? null;

    container.innerHTML = profile
      ? _availableHtml(paymentMethod, profile, totalUsd)
      : _unavailableHtml();

    container.querySelector('#back-btn')?.addEventListener('click', () => {
      navigate('payment');
    });

    if (profile) {
      container.querySelector('#btn-continue')?.addEventListener('click', () => {
        navigate('pago-movil-form', { paymentMethod, totalUsd, ocrAvailable });
      });

      // No-ops when CLIPBOARD_AVAILABLE is false — the buttons were never
      // rendered, so the NodeList is empty and the querySelector is null.
      container.querySelectorAll('.row-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._copy(btn.dataset.copyValue, btn);
        });
      });
      container.querySelector('#copy-all-btn')?.addEventListener('click', (e) => {
        this._copy(e.currentTarget.dataset.copyValue, e.currentTarget);
      });
    } else {
      container.querySelector('#btn-back-alt')?.addEventListener('click', () => {
        navigate('payment');
      });
    }
  },

  unmount() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
  },

  /** @type {number[]} Pending "Copiado" revert timers, cleared on unmount. */
  _timers: [],

  async _copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      this._showCopied(btn);
    } catch (err) {
      // A denied clipboard permission must not escape as an unhandled
      // rejection — main.js's global handler would show the "tap to restart"
      // recovery overlay over a screen that is otherwise perfectly usable.
      console.error('[PaymentAccountScreen] clipboard write failed', err);
    }
  },

  /**
   * Confirm the copy on the button the customer just tapped, rather than via
   * a toast at the top of the screen — their attention is on the row, not the
   * header.
   */
  _showCopied(btn) {
    if (!btn || btn.disabled) return;
    const original = btn.innerHTML;
    btn.innerHTML = `${icon('checkmark')} Copiado`;
    btn.disabled = true;
    const timer = setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      this._timers = this._timers.filter(id => id !== timer);
    }, COPIED_FEEDBACK_MS);
    this._timers.push(timer);
  },
};

function _header() {
  return kioskHeader({ actionLabel: 'Volver', actionId: 'back-btn' });
}

function _availableHtml(paymentMethod, profile, totalUsd) {
  const destinationLabel = paymentMethod === 'mobile_payment' ? 'Teléfono' : 'Número de cuenta';
  const destinationValue = paymentMethod === 'mobile_payment' ? profile.phone : profile.account_number;
  // Plain text, not formatDual() — that returns an HTML fragment carrying the
  // USD annotation in a nested span, which must never reach the clipboard.
  const amountBs = formatBs(usdToBs(totalUsd));

  const allDetails = [
    `Banco: ${profile.bank}`,
    `${destinationLabel}: ${destinationValue}`,
    `Cédula/RIF: ${profile.document_id}`,
    `Monto: ${amountBs}`,
  ].join('\n');

  return `
    <div class="screen active">
      ${_header()}

      <div class="kiosk-body">
        ${_progressSteps(5)}
        <div class="receipt-step-label">5a · Datos de pago</div>

        <div class="text-center">
          <div class="screen-title" style="font-size:16px">Datos para tu pago</div>
          <div class="screen-sub">${esc(METHOD_LABELS[paymentMethod])}</div>
        </div>

        <div class="text-center">
          <span class="chip-tag chip-verified"><span class="chip-dot"></span>Cuenta verificada</span>
        </div>

        <div class="cart-summary">
          <div class="summary-row">
            <span class="summary-row-info">
              <span>${icon('bank')} Banco</span>
              <span>${esc(profile.bank)}</span>
            </span>
            ${_copyBtn(profile.bank)}
          </div>
          <div class="summary-row">
            <span class="summary-row-info">
              <span>${icon('bank')} ${esc(destinationLabel)}</span>
              <span>${esc(destinationValue)}</span>
            </span>
            ${_copyBtn(destinationValue)}
          </div>
          <div class="summary-row">
            <span class="summary-row-info">
              <span>${icon('document')} Cédula/RIF</span>
              <span>${esc(profile.document_id)}</span>
            </span>
            ${_copyBtn(profile.document_id)}
          </div>
          <div class="summary-row total">
            <span class="summary-row-info">
              <span>Monto a pagar</span>
              <span>${formatDual(totalUsd)}</span>
            </span>
            ${_copyBtn(amountBs)}
          </div>
        </div>

        ${_copyAllBtn(allDetails)}
        ${_lastUpdatedHtml(profile.updated_at)}

        <div class="alert-box">
          <div class="alert-icon">${icon('info')}</div>
          <div class="alert-text">
            Verifica estos datos antes de realizar tu pago. Envía exactamente el monto indicado.
          </div>
        </div>
      </div>

      <div class="bottom-bar">
        <button class="btn-primary" id="btn-continue">Ya envié el pago, continuar ${icon('forward')}</button>
      </div>
    </div>
  `;
}

function _copyBtn(value) {
  if (!CLIPBOARD_AVAILABLE) return '';
  return `<button type="button" class="receipt-link row-copy-btn" data-copy-value="${esc(value)}">`
    + `${icon('copy')} Copiar</button>`;
}

function _copyAllBtn(allDetails) {
  if (!CLIPBOARD_AVAILABLE) return '';
  return `
    <div class="text-center">
      <button type="button" class="btn-copy-all" id="copy-all-btn" data-copy-value="${esc(allDetails)}">
        ${icon('copy')} Copiar todos
      </button>
    </div>
  `;
}

/**
 * Rendered only when the API actually supplies a timestamp. RecipientProfile
 * has `updated_at`, but the kiosk serializer does not expose it today — so
 * this normally renders nothing rather than claiming a freshness the kiosk
 * cannot substantiate.
 */
function _lastUpdatedHtml(updatedAt) {
  if (!updatedAt) return '';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `<div class="text-muted">Última actualización: ${esc(day)} a las ${hh}:${mm}</div>`;
}

function _unavailableHtml() {
  return `
    <div class="screen active">
      ${_header()}

      <div class="kiosk-body">
        ${_progressSteps(5)}
        <div class="receipt-step-label">5a · Datos de pago</div>

        <div class="alert-box error">
          <div class="alert-icon">${icon('warning')}</div>
          <div class="alert-text">
            Este método de pago no está disponible en este momento. Vuelve a la pantalla anterior y elige otra opción.
          </div>
        </div>
      </div>

      <div class="bottom-bar">
        <button class="btn-primary" id="btn-back-alt">${icon('back')} Volver</button>
      </div>
    </div>
  `;
}
