/**
 * SettingsScreen.js — native station provisioning.
 *
 * Shown on Capacitor builds when no valid station configuration exists yet (or
 * when the operator re-opens settings). One signed binary ships to every store;
 * the per-station BASE_URL + Kiosk API key are entered here at runtime and saved
 * to localStorage under window.__NATIVE_CONFIG_KEY__. native-config.js merges
 * those values over the bundled defaults on the next load, so the key never has
 * to live inside the app package.
 *
 * Saving persists the values and reloads the app so config.js re-validates with
 * the new settings and bootstrap runs the heartbeat check.
 */

import { esc } from './utils.js';

const FIELDS = [
  { key: 'BASE_URL',             label: 'URL del backend',  type: 'url',    placeholder: 'https://backend.tienda.com' },
  { key: 'KIOSK_API_KEY',        label: 'Clave de estación', type: 'password', placeholder: 'KioskKey provisionada' },
  { key: 'STORE_NAME',           label: 'Nombre de tienda',  type: 'text',   placeholder: 'RetailOps Kiosk' },
  { key: 'STORE_ADDRESS',        label: 'Dirección',         type: 'text',   placeholder: 'Local store' },
  { key: 'KIOSK_STATION_NUMBER', label: 'Número de estación', type: 'text',  placeholder: '1' },
];

export const SettingsScreen = {
  mount(container, _params = {}) {
    const cfg = window.__KIOSK_CONFIG__ || {};

    const rows = FIELDS.map(f => {
      // Do not prefill the placeholder API key with a visible "<KIOSK_API_KEY>".
      let val = cfg[f.key] ?? '';
      if (f.key === 'KIOSK_API_KEY' && String(val).startsWith('<')) val = '';
      return `
        <label class="prov-field">
          <span class="prov-label">${esc(f.label)}</span>
          <input class="prov-input" id="prov-${f.key}" type="${f.type}"
                 value="${esc(val)}" placeholder="${esc(f.placeholder)}"
                 autocapitalize="off" autocomplete="off" spellcheck="false">
        </label>`;
    }).join('');

    container.innerHTML = `
      <div class="screen active">
        <div class="kiosk-body" style="max-width:560px;margin:0 auto;">
          <div class="text-center">
            <div class="screen-title">Configurar estación</div>
            <div class="screen-sub">Ingresa los datos provistos por el administrador</div>
          </div>
          <div class="prov-form">${rows}</div>
          <button id="prov-save" class="btn-primary" style="width:100%;margin-top:16px;">Guardar y reiniciar</button>
          <div id="prov-error" class="text-muted" style="margin-top:10px;color:var(--ft-red);" hidden></div>
        </div>
      </div>
    `;

    container.querySelector('#prov-save').addEventListener('click', () => this._save(container));
  },

  unmount() {},

  _save(container) {
    const out = {};
    for (const f of FIELDS) {
      const el = container.querySelector(`#prov-${f.key}`);
      out[f.key] = (el?.value ?? '').trim();
    }

    const errEl = container.querySelector('#prov-error');
    if (!out.BASE_URL || !out.KIOSK_API_KEY) {
      errEl.textContent = 'La URL del backend y la clave de estación son obligatorias.';
      errEl.hidden = false;
      return;
    }
    if (!/^https?:\/\//i.test(out.BASE_URL)) {
      errEl.textContent = 'La URL debe comenzar con http:// o https://';
      errEl.hidden = false;
      return;
    }

    try {
      const key = window.__NATIVE_CONFIG_KEY__ || 'kiosk_native_config';
      window.localStorage.setItem(key, JSON.stringify(out));
    } catch (e) {
      errEl.textContent = 'No se pudo guardar la configuración en este dispositivo.';
      errEl.hidden = false;
      return;
    }

    // Reload so config.js re-validates and bootstrap re-runs the heartbeat.
    window.location.reload();
  },
};
