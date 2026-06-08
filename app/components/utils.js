/**
 * utils.js — shared HTML helpers used across screen components.
 */

import { CONFIG } from '../config.js';

/**
 * Escape a string for safe insertion into HTML.
 * @param {any} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get initials from a full name (up to 2 characters).
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/**
 * Build the standard kiosk header HTML.
 * @param {object} opts
 * @param {string} [opts.storeName]
 * @param {string} [opts.storeAddress]
 * @param {string} [opts.actionLabel]  Text for the right-side action (e.g. "✕ Cancelar")
 * @param {string} [opts.actionId]     ID for the action element
 * @returns {string}
 */
export function kioskHeader({ storeName, storeAddress, actionLabel, actionId, emptyRight = false } = {}) {
  const name    = storeName    ?? CONFIG?.STORE_NAME    ?? 'RetailOps Kiosk';
  const address = storeAddress ?? CONFIG?.STORE_ADDRESS ?? '';

  const now  = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

  const right = emptyRight
    ? '<div></div>'
    : actionLabel
    ? `<div id="${actionId ?? 'header-action'}" class="header-action">${esc(actionLabel)}</div>`
    : `<div><div class="store-name">${esc(address)}</div><div class="store-time">${time}</div></div>`;

  return `
    <div class="kiosk-header">
      ${brandLogo({ storeName: name })}
      ${right}
    </div>
  `;
}

export function brandLogo({ storeName } = {}) {
  const name     = storeName ?? CONFIG?.STORE_NAME ?? 'RetailOps Kiosk';
  const logoUrl  = CONFIG?.BRAND_LOGO_URL || '';
  const alt      = CONFIG?.BRAND_LOGO_ALT || name;
  const subtitle = CONFIG?.BRAND_SUBTITLE || '';
  const showText = CONFIG?.BRAND_SHOW_TEXT !== false;
  const classes  = [
    'kiosk-logo',
    logoUrl ? 'has-brand-image' : 'has-css-mark',
    showText ? '' : 'logo-image-only',
  ].filter(Boolean).join(' ');

  const image = logoUrl
    ? `<img class="brand-logo-img" src="${esc(logoUrl)}" alt="${esc(alt)}" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;">${_logoIcon(true)}`
    : _logoIcon(false);

  const text = showText
    ? `<div class="brand-wordmark">
        <div class="logo-text">${esc(name)}</div>
        ${subtitle ? `<div class="logo-sub">${esc(subtitle)}</div>` : ''}
      </div>`
    : '';

  return `<div class="${classes}">${image}${text}</div>`;
}

function _logoIcon(hidden) {
  return `
    <div class="logo-icon"${hidden ? ' hidden' : ''}>
      <div class="logo-drop"></div><div class="logo-drop"></div>
      <div class="logo-drop"></div><div class="logo-drop"></div>
    </div>
  `;
}
