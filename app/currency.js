/**
 * currency.js — currency formatting and exchange rate.
 *
 * Bootstrap sequence (called by main.js):
 *   1. initCurrency(CONFIG.USD_TO_BS_RATE)   — sets initial fallback rate,
 *                                              builds formatter
 *   2. applySettings() in services/settings.js:
 *        applyDisplaySettings(symbol, decimals)  — from /api/v1/settings/
 *        applyExchangeRate(rate)                  — from secondary_exchange_rate
 *
 * The Intl.NumberFormat instance is rebuilt only when decimal places change.
 * Updating the exchange rate does not rebuild the formatter because the rate
 * is applied by usdToBs() as a multiplier.
 */

import { CONFIG } from './config.js';

/** @type {Intl.NumberFormat | null} */
let _fmt = null;

/** Current exchange rate (USD → local currency). */
let _rate = CONFIG.USD_TO_BS_RATE;

/**
 * Effective currency symbol — overridden by applyDisplaySettings() when
 * RetailOps system settings are fetched on startup.
 */
let _symbol = CONFIG.CURRENCY_SYMBOL;

/**
 * Effective decimal places — overridden by applyDisplaySettings().
 * @type {number}
 */
let _decimals = CONFIG.DECIMAL_PLACES;

/** Build (or rebuild) the Intl formatter from current module state. */
function _buildFmt() {
  _fmt = new Intl.NumberFormat(CONFIG.LOCALE, {
    minimumFractionDigits: _decimals,
    maximumFractionDigits: _decimals,
  });
}

/**
 * (Re)initialise with a fresh exchange rate.
 * Called by main.js once on bootstrap with the static CONFIG rate.
 * Rebuilds the formatter so the initial display is ready immediately.
 * @param {number} rate  USD → local currency exchange rate
 */
export function initCurrency(rate) {
  _rate = rate;
  _buildFmt();
}

/**
 * Apply live display settings fetched from the RetailOps API.
 * Does not change the exchange rate.
 * @param {string} symbol    Currency symbol (e.g. "Bs.", "$")
 * @param {number} decimals  Decimal places for formatting
 */
export function applyDisplaySettings(symbol, decimals) {
  _symbol   = String(symbol);
  _decimals = Number(decimals);
  _buildFmt();
}

/**
 * Apply the exchange rate from RetailOps system settings.
 * Silently ignores zero / non-positive values so the fallback CONFIG rate
 * is preserved when the secondary currency is disabled or mis-configured.
 * @param {number} rate  USD → secondary currency multiplier
 */
export function applyExchangeRate(rate) {
  const n = Number(rate);
  if (n > 0) _rate = n;
}

/** Returns the active exchange rate (synchronous; always up-to-date). */
export function getRate() {
  return _rate;
}

/**
 * Convert a USD amount to local currency.
 * @param {number|string} usd
 * @returns {number}
 */
export function usdToBs(usd) {
  return Number(usd) * _rate;
}

/**
 * Format a local-currency amount for display (e.g. "Bs. 1.234,56").
 * Uses the effective symbol and decimal places, which may have been
 * updated from the RetailOps system settings after bootstrap.
 * @param {number} amount  Amount already in local currency
 * @returns {string}
 */
export function formatBs(amount) {
  if (!_fmt) _buildFmt();
  return `${_symbol} ${_fmt.format(amount)}`;
}

/**
 * Convert USD → local currency and format for display in one step.
 * @param {number|string} usd
 * @returns {string}
 */
export function formatUsd(usd) {
  return formatBs(usdToBs(usd));
}

/**
 * Format a USD amount with the "$" symbol and 2 decimal places.
 * Kept separate from the locale-formatted local-currency path because USD
 * pricing in the kiosk is always the source-of-truth input (products store
 * unit_price in USD) and is conventionally rendered with "$" regardless of
 * the shopper's locale.
 * @param {number|string} usd
 * @returns {string}
 */
export function formatUsdSymbol(usd) {
  const n = Number(usd) || 0;
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Render a USD amount as dual currency HTML: the local currency dominant,
 * with the USD equivalent as a smaller muted annotation.
 *
 * Returns a safe HTML fragment — the symbols from RetailOps settings are
 * HTML-escaped so an admin-editable currency symbol cannot inject markup.
 * Callers insert this via innerHTML (not textContent).
 *
 *   formatDual(3.49) → 'Bs. 127,39<span class="price-secondary"> ≈ $3.49</span>'
 *
 * @param {number|string} usd
 * @returns {string} HTML fragment
 */
export function formatDual(usd) {
  const usdNum = Number(usd) || 0;
  const bsText  = _escHtml(formatBs(usdToBs(usdNum)));
  const usdText = _escHtml(formatUsdSymbol(usdNum));
  return `${bsText}<span class="price-secondary"> \u2248 ${usdText}</span>`;
}
