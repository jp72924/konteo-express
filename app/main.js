/**
 * main.js — application bootstrap and screen router.
 *
 * Responsibilities:
 * - Import and register all screen components
 * - Wire the navigate() singleton via setNavigate()
 * - Initialise notify, currency, idle timer
 * - Perform initial kiosk authentication
 * - Launch the home screen
 */

import { CONFIG, CONFIG_ERRORS } from './config.js';
import { store }                 from './store.js';
import { setNavigate }           from './router.js';
import { initNotify }            from './notify.js';
import { initCurrency } from './currency.js';
import { applyTheme } from './theme.js';

import { initialLogin }  from './services/auth.js';
import { applySettings } from './services/settings.js';

import { HomeScreen }       from './components/HomeScreen.js';
import { CedulaScreen }     from './components/CedulaScreen.js';
import { RegistroScreen }   from './components/RegistroScreen.js';
import { ScanScreen }       from './components/ScanScreen.js';
import { PaymentScreen }    from './components/PaymentScreen.js';
import { PagoMovilFormScreen } from './components/PagoMovilFormScreen.js';
import { ProcessingScreen } from './components/ProcessingScreen.js';
import { SuccessScreen }    from './components/SuccessScreen.js';
import { SettingsScreen }   from './components/SettingsScreen.js';

// ─── Screen registry ─────────────────────────────────────────────────────────

const SCREENS = {
  home:       HomeScreen,
  cedula:     CedulaScreen,
  registro:   RegistroScreen,
  scan:       ScanScreen,
  payment:    PaymentScreen,
  'pago-movil-form': PagoMovilFormScreen,
  processing: ProcessingScreen,
  success:    SuccessScreen,
  settings:   SettingsScreen,
};

// ─── DOM references ───────────────────────────────────────────────────────────

const appEl          = document.getElementById('app');
const toastEl        = document.getElementById('toast');
const overlayEl      = document.getElementById('startup-overlay');
const overlayMsgEl   = document.getElementById('startup-msg');
const overlayRetryEl = document.getElementById('startup-retry');
const offlineEl      = document.getElementById('offline-overlay');
const installBanner  = document.getElementById('install-banner');
const installBtn     = document.getElementById('install-btn');
const installDismiss = document.getElementById('install-dismiss');

// ─── Offline detection ───────────────────────────────────────────────────────
// Show the offline overlay instantly when the browser reports network loss;
// dismiss it when the connection is restored.  The overlay sits at z-index 300
// so it appears above all screens and the startup overlay.

window.addEventListener('offline', () => { offlineEl.hidden = false; });
window.addEventListener('online',  () => { offlineEl.hidden = true;  });

// ─── PWA install prompt ──────────────────────────────────────────────────────
// The browser fires beforeinstallprompt when the PWA install criteria are met.
// We defer the prompt and show our own banner so the UX is consistent.

/** @type {Event | null} */
let _deferredInstall = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstall = e;

  // Only show the banner if not already running in standalone mode
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    installBanner.hidden = false;
  }
});

installBtn?.addEventListener('click', () => {
  installBanner.hidden = true;
  _deferredInstall?.prompt();
  _deferredInstall = null;
});

installDismiss?.addEventListener('click', () => {
  installBanner.hidden = true;
});

// ─── Current screen state ─────────────────────────────────────────────────────

/** @type {{ mount: Function, unmount: Function } | null} */
let _currentScreen = null;

/** @type {number | null} */
let _idleTimer = null;

// ─── Idle timer ───────────────────────────────────────────────────────────────

function resetIdle() {
  clearTimeout(_idleTimer);

  // Do not reset idle timer while processing — that screen manages its own timeout
  if (_currentScreen === ProcessingScreen) return;

  _idleTimer = setTimeout(() => {
    store.clearSession();
    _doNavigate('home');
  }, CONFIG.IDLE_TIMEOUT_SECONDS * 1000);
}

// Reset on any user interaction
['touchstart', 'mousedown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (_currentScreen !== ProcessingScreen) resetIdle();
  }, { passive: true });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigate to a named screen, unmounting the current one first.
 * @param {string} screenId
 * @param {object} [params]
 */
function _doNavigate(screenId, params = {}) {
  if (_currentScreen) {
    try { _currentScreen.unmount(); } catch { /* ignore */ }
  }

  const Screen = SCREENS[screenId];
  if (!Screen) throw new Error(`Unknown screen: "${screenId}"`);

  _currentScreen = Screen;
  appEl.innerHTML = '';
  Screen.mount(appEl, params);
  resetIdle();
}

setNavigate(_doNavigate);

// Allow operators to re-open station provisioning on native builds (e.g. from a
// maintenance gesture or the dev console): window.openKioskSettings().
window.openKioskSettings = () => _doNavigate('settings');

// ─── Notify setup ─────────────────────────────────────────────────────────────

applyTheme();
initNotify(toastEl);

// ─── Clock in header ─────────────────────────────────────────────────────────

/**
 * Update all .store-time elements with the current time.
 * Called every second via setInterval once the app is running.
 */
function _updateClock() {
  const now  = new Date();
  const hh   = now.getHours().toString().padStart(2, '0');
  const mm   = now.getMinutes().toString().padStart(2, '0');
  const text = `${hh}:${mm}`;
  document.querySelectorAll('.store-time').forEach(el => { el.textContent = text; });
}

// ─── Global error boundary ────────────────────────────────────────────────────
//
// Catches all unhandled errors and promise rejections that escape component
// try/catch blocks. Shows a recovery screen with a single "reiniciar" button
// so the kiosk is never left blank or frozen after an unexpected runtime error.

/** Guard to prevent re-entrant recovery attempts. */
let _recovering = false;

/**
 * Show the startup overlay as a recovery screen.
 *
 * - Unmounts the current screen (aborts in-flight requests).
 * - Clears the idle timer.
 * - Presents "Ocurrió un error inesperado." with a "Tocar para reiniciar" button.
 * - The button calls store.clearSession() and navigates to home, giving the
 *   kiosk a clean state without requiring a full page reload.
 * - Safe to call from synchronous error handlers (no async, no throws).
 */
function _showRecovery() {
  if (_recovering) return;
  _recovering = true;

  try {
    if (_currentScreen) {
      try { _currentScreen.unmount(); } catch { /* ignore */ }
      _currentScreen = null;
    }
    clearTimeout(_idleTimer);
    _idleTimer = null;

    overlayEl.hidden             = false;
    overlayMsgEl.textContent     = 'Ocurrió un error inesperado.';
    overlayRetryEl.textContent   = 'Tocar para reiniciar';
    overlayRetryEl.style.display = '';
    overlayRetryEl.onclick       = () => {
      _recovering = false;
      store.clearSession();
      overlayEl.hidden = true;
      try {
        _doNavigate('home');
      } catch {
        // If navigation itself fails, a full reload is the last resort
        window.location.reload();
      }
    };
  } catch {
    // If even the overlay update fails, reload the page
    window.location.reload();
  }
}

window.onerror = (_msg, _src, _line, _col, err) => {
  console.error('[Unhandled error]', err);
  _showRecovery();
  return true; // suppress browser default error overlay
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled rejection]', event.reason);
  _showRecovery();
  event.preventDefault(); // suppress console error in browser
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  // ── Config validation ────────────────────────────────────────────────────
  // Must happen before any network call. If required fields are missing, show
  // the startup error screen listing every problem and do not proceed.
  if (CONFIG_ERRORS.length > 0) {
    // On native (Capacitor) builds the station is provisioned at runtime — there
    // is no config.local.js to edit — so route to the in-app provisioning screen
    // instead of a dead-end error overlay. On the web, keep the error screen
    // (the operator must fix index.html / config.local.js and reload).
    if (window.__IS_NATIVE__) {
      overlayEl.hidden = true;
      _doNavigate('settings');
      return;
    }
    overlayEl.hidden = false;
    overlayMsgEl.innerHTML =
      `<strong>Error de configuración</strong><br><br>` +
      CONFIG_ERRORS.map(e => `• ${e}`).join('<br>');
    overlayRetryEl.style.display = 'none'; // must edit index.html and reload
    return;
  }

  // Initialise currency with static rate first; live rate loaded below
  initCurrency(CONFIG.USD_TO_BS_RATE);

  try {
    // Validate station API key by pinging the heartbeat endpoint
    await initialLogin();
  } catch (err) {
    overlayEl.hidden = false;
    // Surface the specific error (deactivated station, network error, etc.)
    // so the operator knows exactly what to fix without contacting support.
    overlayMsgEl.textContent = err.message ||
      'No se pudo conectar al servidor. Verifica la configuración.';
    // Only show Retry for transient errors (network); for auth failures the
    // operator must fix the key — reloading won't help.
    const isAuthError = err.code === 'station_deactivated' || err.status === 401;
    overlayRetryEl.style.display = isAuthError ? 'none' : '';
    if (!isAuthError) {
      overlayRetryEl.onclick = () => {
        overlayEl.hidden = true;
        bootstrap();
      };
    }
    return;
  }

  // Hide startup overlay and show the app
  overlayEl.hidden = true;

  // Apply currency symbol / decimal places / exchange rate from SystemSettings
  // (silent fail — CONFIG defaults remain in effect on any error)
  await applySettings();

  // Start clock
  _updateClock();
  setInterval(_updateClock, 60_000);

  // Navigate to home screen
  _doNavigate('home');
}

bootstrap();
