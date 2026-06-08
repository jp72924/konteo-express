/**
 * native-config.js — runtime configuration overrides for native (Capacitor) builds.
 *
 * This is a plain (non-module) script loaded in index.html AFTER the inline
 * __KIOSK_CONFIG__ defaults and config.local.js, but BEFORE app/main.js.
 *
 * Why: a Capacitor binary bundles the static web app and ships to many stations.
 * The per-station Kiosk API key must NOT be baked into the signed package (one
 * binary for all stations, no key in the artifact). Instead the operator
 * provisions the station once at runtime via the in-app SettingsScreen, which
 * persists values to localStorage under NATIVE_CONFIG_KEY. This script merges
 * those saved values over the committed defaults so config.js sees them.
 *
 * On the web (browser PWA) there is usually no saved override, so this is a
 * no-op and the inline defaults / config.local.js remain authoritative.
 */
(function () {
  var NATIVE_CONFIG_KEY = 'kiosk_native_config';

  // Detect Capacitor native runtime (bridge is injected before app scripts).
  var cap = window.Capacitor;
  window.__IS_NATIVE__ = !!(cap && typeof cap.isNativePlatform === 'function'
    ? cap.isNativePlatform()
    : (cap && cap.isNative));

  try {
    var raw = window.localStorage.getItem(NATIVE_CONFIG_KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        window.__KIOSK_CONFIG__ = Object.assign({}, window.__KIOSK_CONFIG__, saved);
      }
    }
  } catch (e) {
    // localStorage unavailable or malformed JSON — fall back to defaults.
  }

  // Expose the storage key so the SettingsScreen reads/writes the same slot.
  window.__NATIVE_CONFIG_KEY__ = NATIVE_CONFIG_KEY;
})();
