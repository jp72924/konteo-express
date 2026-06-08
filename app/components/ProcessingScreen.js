/**
 * ProcessingScreen.js — Order processing (no step number shown; intermediate).
 *
 * Flow:
 *   1. POST /kiosk/checkout/  — atomic: validates stock, creates order,
 *      deducts inventory, records payment, and marks order DELIVERED.
 *   2. On success → navigate to success immediately.
 *
 * Hard timeout via CONFIG.PROCESSING_TIMEOUT_SECONDS.
 * The idle timer in main.js is suspended while this screen is active.
 */

import { CONFIG }   from '../config.js';
import { store }    from '../store.js';
import { navigate } from '../router.js';
import { formatDual } from '../currency.js';
import { atomicCheckout } from '../services/orders.js';
import { esc, kioskHeader, icon } from './utils.js';

const PAYMENT_DISPLAY = {
  cash:           { icon: 'cash',     label: 'Efectivo' },
  mobile_payment: { icon: 'phone',    label: 'Pago movil' },
  bank_transfer:  { icon: 'bank',     label: 'Transferencia bancaria' },
  card:           { icon: 'card',     label: 'Tarjeta debito/credito' },
  check:          { icon: 'document', label: 'Cheque' },
  other:          { icon: 'swap',     label: 'Otro metodo' },
};

export const ProcessingScreen = {
  /** @type {number | null} */
  _timeoutId:  null,
  /** @type {AbortController | null} */
  _controller: null,

  mount(container, params = {}) {
    const { totalUsd, paymentMethod = 'card' } = params;
    const methodInfo = PAYMENT_DISPLAY[paymentMethod] || { icon: 'swap', label: paymentMethod };

    this._controller = new AbortController();

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="processing-body">
          <div class="spinner"></div>

          <div>
            <div class="processing-title">Procesando pago…</div>
            <div class="processing-msg" id="proc-msg">Enviando pedido…</div>
          </div>

          <div class="processing-card">
            <div class="proc-label">Total cobrado</div>
            <div class="proc-total">${formatDual(totalUsd ?? 0)}</div>
            <div class="proc-method"><span class="method-ico">${icon(methodInfo.icon)}</span> ${esc(methodInfo.label)}</div>
          </div>

          <div style="font-size:12px;color:var(--ft-gray-text)">
            Por favor no cierres esta pantalla
          </div>
        </div>
      </div>
    `;

    // Hard timeout — abort checkout if it hangs
    this._timeoutId = setTimeout(() => {
      this._controller?.abort();
      this._controller = null;
      this._showError(container, 'Tiempo de espera agotado. Por favor contacte a un asociado.');
    }, CONFIG.PROCESSING_TIMEOUT_SECONDS * 1000);

    this._runCheckout(container, params).catch(() => {});
  },

  unmount() {
    clearTimeout(this._timeoutId);
    this._timeoutId  = null;
    this._controller?.abort();
    this._controller = null;
  },

  async _runCheckout(container, { paymentMethod = 'card', receipt = null }) {
    const customerId = store.get('customer_id');
    const cart       = store.get('cart') ?? [];
    const signal     = this._controller?.signal;

    // Generate a simple payment reference from timestamp + random suffix.
    // In a real deployment this would come from the card terminal SDK.
    const paymentReference = (receipt?.reference || '').trim() ||
      `KIOSK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    try {
      const result = await atomicCheckout(customerId, cart, paymentReference, signal, {
        paymentMethod,
        receipt,
      });

      // Checkout succeeded — cancel the hard timeout
      clearTimeout(this._timeoutId);
      this._timeoutId  = null;
      this._controller = null;

      // Store receipt data for SuccessScreen
      store.set('order_id',     result.order_id);
      store.set('order_number', result.order_number);
      store.set('payment_number', result.payment_number);
      store.set('payment_status', result.payment_status);

      navigate('success');

    } catch (err) {
      if (err.name === 'AbortError') return; // timeout already handled

      clearTimeout(this._timeoutId);
      this._timeoutId  = null;
      this._controller = null;

      // Surface stock shortfall details
      if (err.code === 'insufficient_stock' && err.details?.insufficient) {
        const lines = err.details.insufficient.map(
          i => `• ${i.sku}: solicitado ${i.requested}, disponible ${i.available}`
        ).join('\n');
        this._showError(container, `Stock insuficiente:\n${lines}`);
      } else if (err.code === 'duplicate_transaction') {
        this._showError(container, 'Este comprobante ya fue registrado. Pide ayuda a un asociado.');
      } else if (err.code === 'receipt_field_mismatch') {
        this._showError(container, 'Los datos del formulario no coinciden con el comprobante. Pide ayuda para revisar el pago.');
      } else if (err.code === 'amount_mismatch') {
        this._showError(container, 'El monto del comprobante no coincide con el total del pedido. Revisa el comprobante o pide ayuda.');
      } else if (err.code === 'incomplete_receipt') {
        this._showError(container, 'No se pudo leer todo el comprobante. Pide ayuda para revisar el pago.');
      } else if (_isOcrUnavailable(err)) {
        this._showError(container, 'La validacion automatica no esta disponible. Pide ayuda a un asociado.');
      } else if (err.code === 'validation_error') {
        this._showError(container, _validationMessage(err.details));
      } else {
        this._showError(container, err.message || 'Algo salió mal. Intenta nuevamente.');
      }
    }
  },

  _showError(container, message) {
    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="processing-body">
          <div class="proc-error-icon" style="font-size:64px">${icon('error')}</div>

          <div>
            <div class="processing-title" style="color:var(--ft-red)">Error de pago</div>
            <div class="processing-msg" style="white-space:pre-line">${esc(message)}</div>
          </div>

          <button class="btn-primary" id="btn-restart" style="max-width:280px">
            Volver al inicio
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btn-restart').addEventListener('click', () => {
      store.clearSession();
      navigate('home');
    });
  },
};

function _validationMessage(details = {}) {
  const lines = [];
  for (const [field, value] of Object.entries(details)) {
    const msg = Array.isArray(value) ? value.join(', ') : String(value);
    lines.push(`${field}: ${msg}`);
  }
  return lines.length
    ? `Por favor revisa los datos ingresados:\n${lines.join('\n')}`
    : 'Por favor revisa los datos ingresados.';
}

function _isOcrUnavailable(err) {
  return [
    'ocr_disabled',
    'ocr_method_disabled',
    'timeout',
    'invalid_response',
    'connection_error',
    'http_502',
    'http_503',
    'http_504',
  ].includes(err.code);
}

function _header() {
  return kioskHeader({ emptyRight: true });
}
