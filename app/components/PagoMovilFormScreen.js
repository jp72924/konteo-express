/**
 * PagoMovilFormScreen.js - receipt capture for mobile payment/bank transfer.
 *
 * The current kiosk creates the order and payment in one atomic checkout call.
 * That means there is normally no sales_order id available at upload time, so
 * the screen can preview and collect the receipt immediately, then sends it to
 * ProcessingScreen for the atomic checkout payload. If a future flow creates a
 * draft order first, the optional OCR verify call below will use it.
 */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { api } from '../api.js';
import { formatBs, formatDual, usdToBs } from '../currency.js';
import { esc, kioskHeader, icon } from './utils.js';
import { _progressSteps } from './HomeScreen.js';

const RECEIPT_METHODS = ['mobile_payment', 'bank_transfer'];
const BANKS = [
  { value: '', label: 'Selecciona un banco' },
  { value: 'BDV', label: 'Banco de Venezuela' },
  { value: 'Bancamiga', label: 'Bancamiga' },
  { value: 'Banesco', label: 'Banesco' },
  { value: 'Mercantil', label: 'Mercantil' },
  { value: 'BBVA Provincial', label: 'BBVA Provincial' },
];

const METHOD_LABELS = {
  mobile_payment: 'Pago movil',
  bank_transfer: 'Transferencia bancaria',
};
const IMAGE_REQUIRED_MESSAGE = 'Sube la imagen del comprobante para continuar.';
const RECEIPT_MISMATCH_MESSAGE = 'Corrige los campos marcados para que coincidan con el comprobante.';
// Recipient mismatch is not fixable from this form — checkout would reject it
// with `recipient_mismatch`, so block here instead of failing at processing.
const RECIPIENT_MISMATCH_MESSAGE = 'El pago fue enviado a una cuenta no registrada. Pide ayuda a un asociado.';

export const PagoMovilFormScreen = {
  /** @type {any} */
  _state: null,

  mount(container, params = {}) {
    const cart = store.get('cart') ?? [];
    const totalUsd = Number(params.totalUsd ?? cart.reduce(
      (s, item) => s + Number(item.unit_price) * item.qty,
      0,
    ));
    const paymentMethod = RECEIPT_METHODS.includes(params.paymentMethod)
      ? params.paymentMethod
      : 'mobile_payment';
    const enabledMethods = store.get('ocr_enabled_methods') ?? [];
    const ocrAvailable = Boolean(
      (params.ocrAvailable ?? store.get('ocr_enabled')) &&
      enabledMethods.includes(paymentMethod)
    );
    const receiptImageRequired = store.get('receipt_image_required_for_receipt_methods') !== false;

    this._state = {
      totalUsd,
      totalBs: usdToBs(totalUsd),
      paymentMethod,
      ocrAvailable,
      receiptImageRequired,
      verified: false,
      receiptMatched: false,
      recipientMismatch: false,
      ocrData: null,
      receiptFields: {},
      expectedFields: {},
      fieldMatches: {},
      mismatches: {},
      imageDataUrl: '',
      imageName: '',
      imageType: '',
      documentPrefix: 'V',
    };

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="kiosk-body">
          ${_progressSteps(5)}
          <div class="receipt-step-label">5b · Comprobante</div>

          <div class="text-center">
            <div class="screen-title" style="font-size:16px">Comprobante de pago</div>
            <div class="screen-sub">${esc(METHOD_LABELS[paymentMethod])}</div>
          </div>

          <div class="cart-summary">
            <div class="summary-row total">
              <span>Total a pagar</span>
              <span>${formatDual(totalUsd)}</span>
            </div>
          </div>

          ${ocrAvailable || receiptImageRequired ? _uploadCardHtml() : _manualOnlyHtml()}

          <div class="section-label">Datos del pago</div>

          <div class="receipt-form">
            <div class="field-group">
              <label class="field-label" for="origin-bank">Banco emisor <span>*</span></label>
              <div class="select-wrap">
                <select class="ft-select" id="origin-bank">
                  ${BANKS.map(b => `<option value="${esc(b.value)}">${esc(b.label)}</option>`).join('')}
                </select>
              </div>
              <div class="field-err" id="origin-bank-err"></div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label" for="origin-phone">Telefono origen <span>*</span></label>
                <input class="ft-input" id="origin-phone" type="tel" inputmode="tel" placeholder="0412-1234567">
                <div class="field-err" id="origin-phone-err"></div>
              </div>
              <div class="field-group">
                <label class="field-label" for="origin-document">Cedula origen <span>*</span></label>
                <div class="receipt-document-row">
                  <div class="cedula-type-btns compact">
                    <button type="button" class="cedula-type-btn selected" data-prefix="V">V</button>
                    <button type="button" class="cedula-type-btn" data-prefix="E">E</button>
                  </div>
                  <input class="ft-input" id="origin-document" type="text" inputmode="numeric" placeholder="12345678">
                </div>
                <div class="field-err" id="origin-document-err"></div>
              </div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label" for="receipt-reference">Referencia <span>*</span></label>
                <input class="ft-input receipt-mono" id="receipt-reference" type="text" inputmode="numeric" placeholder="000123">
                <div class="field-err" id="receipt-reference-err"></div>
              </div>
              <div class="field-group">
                <label class="field-label" for="paid-at">Fecha del pago <span>*</span></label>
                <input class="ft-input" id="paid-at" type="date">
                <div class="field-err" id="paid-at-err"></div>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label" for="paid-amount">Monto pagado</label>
              <input class="ft-input" id="paid-amount" type="text" value="${esc(formatBs(this._state.totalBs))}" readonly>
              <div class="field-err" id="paid-amount-err"></div>
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <button class="btn-primary" id="btn-confirm-receipt" disabled>Confirmar pago ${icon('forward')}</button>
        </div>
      </div>
    `;

    this._bind(container);
    this._setDefaultDate(container);
    this._updateConfirm(container);
  },

  unmount() {
    this._state = null;
  },

  _bind(container) {
    container.querySelector('#back-btn')?.addEventListener('click', () => {
      // Back to the account-details screen (not straight to PaymentScreen) so
      // back-navigation doesn't skip past it; forward the current method/total
      // so it re-renders correctly instead of falling back to defaults.
      navigate('payment-account', {
        paymentMethod: this._state.paymentMethod,
        totalUsd: this._state.totalUsd,
        ocrAvailable: this._state.ocrAvailable,
      });
    });

    container.querySelector('#receipt-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this._handleFile(container, file).catch(() => {});
    });

    container.querySelector('#change-photo')?.addEventListener('click', () => {
      container.querySelector('#receipt-file')?.click();
    });

    container.querySelectorAll('.cedula-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this._state.verified) return;
        this._state.documentPrefix = btn.dataset.prefix || 'V';
        container.querySelectorAll('.cedula-type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._updateConfirm(container);
      });
    });

    container.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => {
        this._revalidateReceiptFields(container);
        this._updateConfirm(container);
      });
      el.addEventListener('change', () => {
        this._revalidateReceiptFields(container);
        this._updateConfirm(container);
      });
    });

    container.querySelector('#btn-confirm-receipt').addEventListener('click', () => {
      const receipt = this._buildReceiptPayload(container);
      navigate('processing', {
        paymentMethod: this._state.paymentMethod,
        totalUsd: this._state.totalUsd,
        receipt,
      });
    });
  },

  async _handleFile(container, file) {
    const maxMb = Number(store.get('ocr_max_file_mb') || 5);
    if (file.size > maxMb * 1024 * 1024) {
      this._showStatus(container, 'error', `La imagen debe pesar ${maxMb} MB o menos.`);
      return;
    }

    this._state.imageDataUrl = await _fileToDataUrl(file);
    this._state.imageName = file.name || 'receipt.jpg';
    this._state.imageType = file.type || 'application/octet-stream';
    this._state.verified = false;
    this._state.receiptMatched = false;
    this._state.recipientMismatch = false;
    this._state.ocrData = null;
    this._state.receiptFields = {};
    this._state.expectedFields = {};
    this._state.fieldMatches = {};
    this._state.mismatches = {};

    const preview = container.querySelector('#receipt-preview');
    const thumb = container.querySelector('#receipt-thumb');
    if (thumb) thumb.src = this._state.imageDataUrl;
    if (preview) preview.hidden = false;

    if (!this._state.ocrAvailable) {
      this._showStatus(container, 'error', 'La validacion automatica no esta disponible. Pide ayuda a un asociado.');
      this._updateConfirm(container);
      return;
    }

    this._showStatus(container, 'info', 'Verificando comprobante...');

    const form = new FormData();
    form.append('image', file);
    form.append('payment_method', this._state.paymentMethod);
    form.append('expected_amount_usd', Number(this._state.totalUsd).toFixed(2));
    const orderId = store.get('order_id');
    if (orderId) form.append('sales_order', String(orderId));
    const expected = this._expectedFields(container);
    if (expected.reference) form.append('expected_reference', expected.reference);
    if (expected.paid_on) form.append('expected_paid_on', expected.paid_on);
    if (expected.origin_bank) form.append('expected_origin_bank', expected.origin_bank);

    try {
      const result = await api.postForm('/payments/receipts/verify/', form);
      this._applyOcrResult(container, result);
      if (this._state.recipientMismatch) {
        this._showStatus(container, 'error', RECIPIENT_MISMATCH_MESSAGE);
      } else if (this._state.receiptMatched) {
        this._showStatus(container, 'success', 'Comprobante verificado.');
      } else {
        this._showStatus(container, 'error', RECEIPT_MISMATCH_MESSAGE);
      }
    } catch (err) {
      if (err.code === 'receipt_field_mismatch' && err.payload) {
        this._applyOcrResult(container, err.payload);
      } else {
        this._state.verified = false;
        this._state.receiptMatched = false;
        this._state.ocrData = err.payload || null;
      }
      this._showStatus(container, 'error', _receiptErrorMessage(err));
    }

    this._updateConfirm(container);
  },

  _applyOcrResult(container, result) {
    this._state.ocrData = result;
    this._state.receiptFields = _receiptFieldsFromResult(result);
    this._state.recipientMismatch = _isRecipientMismatch(result);
    this._prefillFromOcr(container, result);
    this._revalidateReceiptFields(container);
  },

  _prefillFromOcr(container, result) {
    const checks = result.checks || {};
    const receiptFields = checks.receipt_fields || {};
    _setBlankValue(container, '#origin-phone', checks.origin_phone || '');
    _setBlankValue(
      container,
      '#origin-bank',
      _bankValue(receiptFields.origin_bank || checks.origin_bank || checks.bank_app || ''),
    );
    _setBlankValue(
      container,
      '#receipt-reference',
      receiptFields.reference || checks.payment_reference || '',
    );

    const when = receiptFields.paid_on ||
      _get(result.vepay, ['payment', 'date_time', 'iso']) ||
      _get(result.vepay, ['payment', 'date', 'iso']);
    if (when) _setBlankValue(container, '#paid-at', _toDateOnlyLocal(when));
  },

  _lockFields(container, locked) {
    ['#origin-phone', '#origin-document', '#receipt-reference', '#paid-at']
      .forEach(sel => {
        const el = container.querySelector(sel);
        if (el) el.readOnly = locked;
      });
    const bank = container.querySelector('#origin-bank');
    if (bank) bank.disabled = locked;
    container.querySelectorAll('.cedula-type-btn').forEach(btn => {
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    });
  },

  _setDefaultDate(container) {
    const el = container.querySelector('#paid-at');
    if (el && !el.value) el.value = _toDateOnlyLocal(new Date());
  },

  _updateConfirm(container) {
    const btn = container.querySelector('#btn-confirm-receipt');
    if (!btn) return;

    const required = [
      '#origin-bank',
      '#origin-phone',
      '#origin-document',
      '#receipt-reference',
      '#paid-at',
    ];
    const imageRequired = this._state.receiptImageRequired &&
      RECEIPT_METHODS.includes(this._state.paymentMethod);
    const hasImage = Boolean(this._state.imageDataUrl);
    const receiptValidationRequired = RECEIPT_METHODS.includes(this._state.paymentMethod) &&
      (imageRequired || hasImage);
    const complete = required.every(sel => (container.querySelector(sel)?.value || '').trim());
    const statusEl = container.querySelector('#receipt-status');

    if (imageRequired && !hasImage) {
      this._showStatus(container, 'info', IMAGE_REQUIRED_MESSAGE);
    } else if (receiptValidationRequired && !this._state.ocrAvailable) {
      this._showStatus(container, 'error', 'La validacion automatica no esta disponible. Pide ayuda a un asociado.');
    } else if (this._state.recipientMismatch) {
      // Wins over the field-mismatch branches: editing the form cannot fix it.
      this._showStatus(container, 'error', RECIPIENT_MISMATCH_MESSAGE);
    } else if (
      receiptValidationRequired &&
      hasImage &&
      this._state.ocrData &&
      !this._state.receiptMatched
    ) {
      this._showStatus(container, 'error', RECEIPT_MISMATCH_MESSAGE);
    } else if (
      receiptValidationRequired &&
      hasImage &&
      this._state.ocrData &&
      this._state.receiptMatched &&
      statusEl?.textContent === RECEIPT_MISMATCH_MESSAGE
    ) {
      this._showStatus(container, 'success', 'Comprobante verificado.');
    } else if (statusEl?.textContent === IMAGE_REQUIRED_MESSAGE) {
      statusEl.hidden = true;
    }

    btn.disabled = !(
      complete &&
      (!imageRequired || hasImage) &&
      (!receiptValidationRequired || this._state.receiptMatched) &&
      !this._state.recipientMismatch
    );
  },

  _expectedFields(container) {
    return {
      amount_usd: Number(this._state.totalUsd).toFixed(2),
      reference: (container.querySelector('#receipt-reference')?.value || '').trim(),
      paid_on: (container.querySelector('#paid-at')?.value || '').trim(),
      origin_bank: (container.querySelector('#origin-bank')?.value || '').trim(),
    };
  },

  _revalidateReceiptFields(container) {
    if (!this._state?.ocrData) {
      this._clearFieldErrors(container);
      return;
    }

    const expected = this._expectedFields(container);
    const receipt = this._state.receiptFields || {};
    const fieldMatches = {
      amount_usd: _money(expected.amount_usd) === _money(receipt.amount_usd),
      reference: Boolean(expected.reference) &&
        _normReference(expected.reference) === _normReference(receipt.reference),
      paid_on: Boolean(expected.paid_on) &&
        _toDateOnlyLocal(expected.paid_on) === _toDateOnlyLocal(receipt.paid_on),
      origin_bank: Boolean(expected.origin_bank) &&
        _normBank(expected.origin_bank) === _normBank(receipt.origin_bank),
    };
    const mismatches = {};
    Object.entries(fieldMatches).forEach(([key, matched]) => {
      if (!matched) {
        mismatches[key] = {
          expected: expected[key] || '',
          actual: receipt[key] || '',
        };
      }
    });

    this._state.expectedFields = expected;
    this._state.fieldMatches = fieldMatches;
    this._state.mismatches = mismatches;
    this._state.receiptMatched = Object.values(fieldMatches).every(Boolean);
    this._state.verified = this._state.receiptMatched;
    this._applyFieldErrors(container);
  },

  _clearFieldErrors(container) {
    [
      '#origin-bank-err',
      '#receipt-reference-err',
      '#paid-at-err',
      '#paid-amount-err',
    ].forEach(sel => {
      const el = container.querySelector(sel);
      if (el) el.textContent = '';
    });
  },

  _applyFieldErrors(container) {
    this._clearFieldErrors(container);
    const mismatches = this._state.mismatches || {};
    _setText(container, '#origin-bank-err', mismatches.origin_bank ? 'No coincide con el banco del comprobante.' : '');
    _setText(container, '#receipt-reference-err', mismatches.reference ? 'No coincide con la referencia del comprobante.' : '');
    _setText(container, '#paid-at-err', mismatches.paid_on ? 'No coincide con la fecha del comprobante.' : '');
    _setText(container, '#paid-amount-err', mismatches.amount_usd ? 'No coincide con el monto del comprobante.' : '');
  },

  _buildReceiptPayload(container) {
    const doc = (container.querySelector('#origin-document')?.value || '').trim();
    const reference = (container.querySelector('#receipt-reference')?.value || '').trim();
    const ocrChecks = this._state.ocrData?.checks || {};

    return {
      origin_bank: (container.querySelector('#origin-bank')?.value || '').trim(),
      origin_phone: (container.querySelector('#origin-phone')?.value || '').trim(),
      origin_document: `${this._state.documentPrefix}-${doc}`,
      reference,
      paid_on: (container.querySelector('#paid-at')?.value || '').trim(),
      amount_usd: Number(this._state.totalUsd).toFixed(2),
      amount_bs: Number(this._state.totalBs).toFixed(2),
      ocr_verified: this._state.receiptMatched,
      ocr_receipt_data: this._state.ocrData?.vepay || null,
      transaction_key: ocrChecks.transaction_key || '',
      receipt_image_base64: this._state.imageDataUrl,
      receipt_image_name: this._state.imageName,
      receipt_image_content_type: this._state.imageType,
    };
  },

  _showStatus(container, tone, message) {
    const el = container.querySelector('#receipt-status');
    if (!el) return;
    el.hidden = false;
    el.className = `receipt-status ${tone}`;
    el.textContent = message;
  },
};

function _uploadCardHtml() {
  return `
    <div class="receipt-upload-card">
      <div class="section-label">Comprobante</div>
      <label class="receipt-upload" for="receipt-file">
        <input id="receipt-file" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/*" capture="environment" hidden>
        <span class="receipt-upload-icon">${icon('camera')}</span>
        <span>
          <strong>Sube la captura de tu comprobante</strong>
          <small>JPG, PNG, HEIC o HEIF</small>
        </span>
      </label>
      <div class="receipt-preview" id="receipt-preview" hidden>
        <img id="receipt-thumb" alt="Comprobante seleccionado">
        <button type="button" class="receipt-link" id="change-photo">Cambiar foto</button>
      </div>
      <div class="receipt-status" id="receipt-status" hidden></div>
    </div>
  `;
}

function _manualOnlyHtml() {
  return `
    <div class="alert-box">
      <div class="alert-icon">ℹ</div>
      <div class="alert-text">
        La validacion automatica no esta disponible. Pide ayuda a un asociado.
      </div>
    </div>
    <div class="receipt-status info" id="receipt-status" hidden></div>
  `;
}

function _header() {
  return kioskHeader({ actionLabel: 'Volver', actionId: 'back-btn' });
}

function _fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function _setBlankValue(container, selector, value) {
  const el = container.querySelector(selector);
  if (el && !String(el.value || '').trim() && value != null) el.value = String(value);
}

function _setText(container, selector, value) {
  const el = container.querySelector(selector);
  if (el) el.textContent = value;
}

function _get(obj, path) {
  return path.reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

function _bankValue(value) {
  const normalized = _normBank(value);
  const match = BANKS.find(bank => bank.value && _normBank(bank.value) === normalized);
  return match?.value || '';
}

function _receiptFieldsFromResult(result) {
  const checks = result?.checks || {};
  const fields = checks.receipt_fields || {};
  return {
    amount_usd: fields.amount_usd || checks.amount_normalized_usd || '',
    reference: fields.reference || checks.payment_reference || '',
    paid_on: fields.paid_on || checks.paid_on || '',
    origin_bank: fields.origin_bank || checks.origin_bank || checks.bank_app || '',
  };
}

/**
 * Read the verify endpoint's non-blocking `checks.recipient_match` advisory.
 *
 * The backend only fills it in when recipient validation is enabled (it is
 * `null` otherwise), so the store flag is a guard, not the sole condition:
 * only an explicit `matched === false` blocks, never a missing/unknown check.
 */
function _isRecipientMismatch(result) {
  if (store.get('recipient_validation_enabled') !== true) return false;
  const recipientMatch = result?.checks?.recipient_match;
  return Boolean(recipientMatch) && recipientMatch.matched === false;
}

function _toDateOnlyLocal(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function _money(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '';
}

function _normReference(value) {
  return String(value || '').replace(/[^0-9A-Za-z]+/g, '').toUpperCase();
}

function _normBank(value) {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z]+/g, ' ')
    .trim()
    .toUpperCase();
  const aliases = {
    BDV: 'BDV',
    'BANCO DE VENEZUELA': 'BDV',
    'BCO DE VENEZUELA': 'BDV',
    VENEZUELA: 'BDV',
    BANCAMIGA: 'BANCAMIGA',
    BANESCO: 'BANESCO',
    MERCANTIL: 'MERCANTIL',
    'BANCO MERCANTIL': 'MERCANTIL',
    'BBVA PROVINCIAL': 'BBVA PROVINCIAL',
    'BANCO PROVINCIAL': 'BBVA PROVINCIAL',
    PROVINCIAL: 'BBVA PROVINCIAL',
  };
  return aliases[raw] || raw;
}

function _receiptErrorMessage(err) {
  if (err.code === 'duplicate_transaction') {
    return 'Este comprobante ya fue registrado. Pide ayuda a un asociado.';
  }
  if (err.code === 'receipt_field_mismatch') {
    return 'Los datos del formulario no coinciden con el comprobante.';
  }
  if (err.code === 'amount_mismatch') {
    return 'El monto del comprobante no coincide con el total. Pide ayuda a un asociado.';
  }
  if (err.code === 'recipient_mismatch') {
    return RECIPIENT_MISMATCH_MESSAGE;
  }
  if (err.code === 'incomplete_receipt') {
    return 'No se pudo leer todo el comprobante. Pide ayuda a un asociado.';
  }
  if (_isOcrUnavailable(err)) {
    return 'La validacion automatica no esta disponible. Pide ayuda a un asociado.';
  }
  return err.message || 'No se pudo verificar el comprobante. Pide ayuda a un asociado.';
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
