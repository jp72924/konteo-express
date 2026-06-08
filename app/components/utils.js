/**
 * utils.js — shared HTML helpers used across screen components.
 */

import { CONFIG } from '../config.js';

/**
 * Inline line-icon set (Konteo Express design language).
 * 24×24, stroke=currentColor, no fill — the same style as the brand site.
 * Sized via `font-size`/`width` on the host element; colour via `color`.
 */
const _ICON_PATHS = {
  cart:    '<circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M2.5 3.5h2.2l2 11.2a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L20 7H6"/>',
  help:    '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M4 13a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2zM20 13a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2z"/><path d="M18 18v.5a3 3 0 0 1-3 3h-3"/>',
  info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.6"/>',
  camera:  '<path d="M3 8.5A2 2 0 0 1 5 6.5h1.6l1.2-2h8.4l1.2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  cash:    '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  phone:   '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M10.5 18.5h3"/>',
  bank:    '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>',
  card:    '<rect x="2.5" y="5" width="19" height="14" rx="2.6"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
  document:'<path d="M6 2.5h7l5 5v14H6z"/><path d="M13 2.5v5h5"/><path d="M9 13h6M9 16.5h4"/>',
  swap:    '<path d="M4 9h13l-3.2-3.2"/><path d="M20 15H7l3.2 3.2"/>',
  lock:    '<rect x="5" y="11" width="14" height="9.5" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  warning: '<path d="M12 3.2 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 16.8v.4"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check:   '<circle cx="12" cy="12" r="9.3"/><path d="m8 12.2 2.8 2.8L16 9.5"/>',
  error:   '<circle cx="12" cy="12" r="9.3"/><path d="m9 9 6 6M15 9l-6 6"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M12 7.5v6"/><path d="m9.5 11 2.5 2.5L14.5 11"/>',
  offline: '<path d="M2 8.7a16 16 0 0 1 20 0"/><path d="M5.5 12.2a11 11 0 0 1 13 0"/><path d="M9 15.7a6 6 0 0 1 6 0"/><path d="M12 19.2v.2"/><path d="M3 3l18 18"/>',
  mars:    '<circle cx="10" cy="14" r="6"/><path d="M14.5 9.5 20 4"/><path d="M15 4h5v5"/>',
  venus:   '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21"/><path d="M9 18h6"/>',
};

/**
 * Return an inline SVG icon string.
 * @param {keyof typeof _ICON_PATHS} name
 * @param {{cls?:string, size?:string}} [opts]
 */
export function icon(name, { cls = '', size = '' } = {}) {
  const body = _ICON_PATHS[name];
  if (!body) return '';
  const sizeAttr = size ? ` style="width:${size};height:${size}"` : '';
  const cn = ('kx-ico ' + cls).trim();
  return `<svg class="${cn}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
    + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${sizeAttr}>${body}</svg>`;
}

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
