/**
 * api.js — authenticated HTTP client for the RetailOps Kiosk API.
 *
 * All fetch calls go through this module. It handles:
 * - Attaching the per-station KioskKey header from CONFIG
 * - Normalising error responses to ApiError instances
 * - JSON serialisation / deserialisation, plus multipart uploads
 *
 * There is no token exchange or re-authentication. The KIOSK_API_KEY is a
 * static per-station credential provisioned by an admin. If the server returns
 * 401 it means the station has been deactivated — a terminal error that requires
 * admin intervention, not an automatic retry.
 */

import { CONFIG } from './config.js';

const BASE = CONFIG.BASE_URL + CONFIG.API_PATH;

/** Structured error thrown by api.* on non-2xx responses. */
export class ApiError extends Error {
  /**
   * @param {string} message   Human-readable description
   * @param {string} code      RetailOps error code or HTTP status string
   * @param {number} status    HTTP status code
   * @param {object} details   Field-level validation details (may be empty)
   */
  constructor(message, code, status, details = {}) {
    super(message);
    this.name    = 'ApiError';
    this.code    = code;
    this.status  = status;
    this.details = details;
  }
}

/**
 * Core request helper.
 * @param {string}       method
 * @param {string}       path     Path relative to BASE (e.g. '/kiosk/identify/')
 * @param {any}          [body]
 * @param {AbortSignal}  [signal] Optional AbortSignal for cancellation
 */
async function _request(method, path, body, signal) {
  // Fast-fail if the browser knows the network is gone
  if (!navigator.onLine) {
    throw new ApiError('Sin conexión. Verifica tu red.', 'network_error', 0);
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {
    'Authorization': `KioskKey ${CONFIG.KIOSK_API_KEY}`,
  };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body !== undefined) opts.body = isFormData ? body : JSON.stringify(body);
  if (signal) opts.signal = signal;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err; // propagate cancellation as-is
    throw new ApiError('Sin conexión. Verifica tu red.', 'network_error', 0);
  }

  // 401 means the station API key is invalid or the station has been deactivated.
  // This is a terminal condition — no retry, no re-auth.
  if (res.status === 401 || res.status === 403) {
    throw new ApiError(
      'Estación desactivada. Contacte a un administrador.',
      'station_deactivated',
      res.status,
    );
  }

  // 204 No Content
  if (res.status === 204) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg = _codeToSpanish(json.code, res.status);
    const details = json.details && typeof json.details === 'object' ? json.details : {};
    if (json.insufficient) details.insufficient = json.insufficient;
    if (json.checks) details.checks = json.checks;
    if (json.warnings) details.warnings = json.warnings;
    if (json.vepay) details.vepay = json.vepay;
    const err = new ApiError(msg, json.code || String(res.status), res.status, details);
    err.payload = json;
    throw err;
  }

  return json;
}

/** Map RetailOps error codes → user-facing Spanish messages. */
function _codeToSpanish(code, status) {
  switch (code) {
    case 'validation_error':      return 'Por favor revisa los datos ingresados.';
    case 'station_deactivated':
    case 'not_authenticated':
    case 'authentication_failed': return 'Estación desactivada. Contacte a un administrador.';
    case 'permission_denied':     return 'Sin permisos para realizar esta acción. Contacte a un asociado.';
    case 'throttled':             return 'Demasiadas solicitudes. Espera un momento.';
    case 'insufficient_stock':    return 'Stock insuficiente para uno o más productos.';
    case 'invalid_product':       return 'Producto no válido o no disponible.';
    case 'not_found':             return 'Recurso no encontrado.';
    case 'duplicate_national_id': return 'Esta cédula ya está registrada.';
    case 'duplicate_transaction': return 'Este comprobante ya fue registrado.';
    case 'receipt_field_mismatch': return 'Los datos del formulario no coinciden con el comprobante.';
    case 'amount_mismatch':       return 'El monto del comprobante no coincide con el pedido.';
    case 'incomplete_receipt':    return 'No se pudo leer todo el comprobante.';
    case 'ocr_disabled':
    case 'ocr_method_disabled':
    case 'timeout':
    case 'invalid_response':
    case 'connection_error':
    case 'http_502':
    case 'http_503':
    case 'http_504':             return 'La validacion automatica no esta disponible.';
    default:
      if (status >= 500) return 'Error del servidor. Intenta nuevamente.';
      return 'Algo salió mal. Intenta nuevamente.';
  }
}

export const api = {
  /** GET request. Pass `{ signal }` as opts to support cancellation. */
  get:    (path, opts = {})       => _request('GET',    path, undefined, opts.signal),
  /** POST request with JSON body. Pass `{ signal }` as opts to support cancellation. */
  post:   (path, body, opts = {}) => _request('POST',   path, body,      opts.signal),
  /** POST request with FormData body. Pass `{ signal }` as opts to support cancellation. */
  postForm: (path, body, opts = {}) => _request('POST', path, body,      opts.signal),
  /** PATCH request with JSON body. */
  patch:  (path, body, opts = {}) => _request('PATCH',  path, body,      opts.signal),
  /** DELETE request. */
  delete: (path, opts = {})       => _request('DELETE', path, undefined, opts.signal),
};
