/**
 * sw.js — RetailOps Kiosk Service Worker
 *
 * ── Cache strategies ────────────────────────────────────────────────────────
 *
 *  Navigation requests (HTML document)  →  NETWORK-FIRST
 *    Always fetch fresh HTML from the server when online.  The cached copy is
 *    used only when the network is unavailable (true offline mode).
 *    Rationale: serving a stale cached HTML document can leave the browser in
 *    an inconsistent state where some resources were fetched without a SW
 *    controller and others are served from SW cache, causing ES module loading
 *    to silently fail on some Chrome versions (observed as a blank gray screen
 *    on every load after the first).
 *
 *  All other same-origin GET requests (CSS, JS, assets)  →  CACHE-FIRST
 *    Served from pre-populated cache for fast loads; fetched from network and
 *    cached dynamically on first miss.
 *
 *  Cross-origin requests  →  NOT INTERCEPTED
 *    API calls go to a different port (8000 vs 8080) — different origin.
 *    The SW never sees them; the browser sends them directly.
 *
 *  /sw.js itself  →  NOT INTERCEPTED
 *    The browser must be able to fetch the SW script directly to detect
 *    updates.  Caching it would prevent the browser's byte-diff update check.
 *
 * ── SW lifecycle ─────────────────────────────────────────────────────────────
 *
 *  skipWaiting()    is called from install so the new SW activates as soon as
 *                   it finishes pre-caching, without waiting for existing tabs
 *                   to close.
 *
 *  clients.claim()  is intentionally OMITTED.  Without it, the SW does not
 *                   take over pages that are already open and mid-load.  It
 *                   only controls pages that open after activation.  This
 *                   prevents the race condition where the SW hijacks a live
 *                   page that is still importing ES modules, causing some
 *                   imports to resolve from the network and others from cache.
 *
 * ── Cache versioning ─────────────────────────────────────────────────────────
 *
 *  Increment CACHE_VERSION whenever any app file changes so that the new SW
 *  pre-caches fresh copies and the activate handler purges the old cache.
 *  Keep CACHE_VERSION in sync with CONFIG.APP_VERSION in index.html.
 */

const CACHE_VERSION = '2.2.0'; // keep in sync with CONFIG.APP_VERSION in index.html
let   CACHE_NAME    = `retailops-kiosk-v${CACHE_VERSION}`;
const APP_SHELL_URL = new URL('./index.html', self.location.href).href;
const SW_URL_PATH = new URL('./sw.js', self.location.href).pathname;
const LOCAL_CONFIG_PATH = new URL('./config.local.js', self.location.href).pathname;

/**
 * Application shell — all files required to run the kiosk offline.
 * Navigation (HTML) is intentionally excluded; it is always fetched fresh
 * from the network and only falls back to this cache when offline.
 */
const SHELL_ASSETS = [
  './index.html',
  './styles.css',
  './manifest.json',
  './assets/branding/koteo-express-logo.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './app/main.js',
  './app/native-config.js',
  './app/config.js',
  './app/store.js',
  './app/router.js',
  './app/notify.js',
  './app/api.js',
  './app/currency.js',
  './app/theme.js',
  './app/services/auth.js',
  './app/services/customer.js',
  './app/services/orders.js',
  './app/services/payments.js',
  './app/services/products.js',
  './app/services/settings.js',
  './app/components/utils.js',
  './app/components/HomeScreen.js',
  './app/components/CedulaScreen.js',
  './app/components/RegistroScreen.js',
  './app/components/ScanScreen.js',
  './app/components/PaymentScreen.js',
  './app/components/PagoMovilFormScreen.js',
  './app/components/ProcessingScreen.js',
  './app/components/SuccessScreen.js',
  './app/components/SettingsScreen.js',
];

// ── Version negotiation ──────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_VERSION') {
    CACHE_NAME = `retailops-kiosk-v${event.data.version}`;
  }
});

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Purge caches from previous SW versions.
// clients.claim() is intentionally absent — see the strategy note above.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // 2. Only handle GET requests
  if (request.method !== 'GET') return;

  // 3. Never intercept the SW script itself — the browser must be able to
  //    byte-diff it directly to detect updates
  if (url.pathname === SW_URL_PATH) return;

  // Station config can contain live credentials and changes independently from
  // the app shell. Always go to the network and never cache it.
  if (url.pathname === LOCAL_CONFIG_PATH) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('', {
          status: 404,
          headers: { 'Content-Type': 'application/javascript' },
        })
      )
    );
    return;
  }

  // ── Navigation requests → network-first ───────────────────────────────────
  //
  // Always try the network so the browser always gets fresh HTML.  Only fall
  // back to the cached copy when the network is genuinely unavailable.
  //
  // This prevents the "gray screen on refresh" bug where serving a stale
  // cached HTML document causes ES module loading to silently fail because
  // some modules were originally loaded without a SW controller while others
  // are now served from SW cache.

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Network failed → serve cached HTML so the kiosk UI loads offline
          caches.match(request).then((r) => r || caches.match(APP_SHELL_URL))
        )
    );
    return;
  }

  // ── All other GET requests → cache-first ──────────────────────────────────
  //
  // Serve CSS, JS, images, and other assets from cache for instant loads.
  // On first miss: fetch from network, cache, and return.

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Last resort: return the app shell for graceful degradation
          caches.match(APP_SHELL_URL)
        );
    })
  );
});
