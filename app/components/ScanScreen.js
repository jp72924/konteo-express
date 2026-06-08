/**
 * ScanScreen.js — Product search and cart (Step 4 of 5).
 *
 * - Debounced product search (300ms, min 2 chars) via the search bar
 * - Optional barcode scanner input (activated by CONFIG.BARCODE_ENABLED)
 * - Up to 6 result preview cards; tapping adds to cart
 * - Cart deduplication: same product increments quantity
 * - Stock checks on add and before proceeding to payment
 * - Full cart summary with per-item remove buttons
 *
 * The text-search and barcode paths share _showSearchResults() for result
 * rendering and _addProduct() for stock-check and cart-deduplication logic.
 */

import { CONFIG }       from '../config.js';
import { store }        from '../store.js';
import { navigate }     from '../router.js';
import { notify }       from '../notify.js';
import { formatUsd, usdToBs, formatBs, formatDual } from '../currency.js';
import { searchProducts, getProduct }   from '../services/products.js';
import { esc, initials, kioskHeader, icon } from './utils.js';
import { _progressSteps } from './HomeScreen.js';

export const ScanScreen = {
  /** @type {AbortController | null} */
  _searchAbort: null,
  /** @type {ReturnType<typeof setTimeout> | null} */
  _debounceTimer: null,
  /** @type {(() => void) | null} Unsubscribe for exchange_rate_unavailable */
  _rateUnsub: null,

  mount(container, _params = {}) {
    this._searchAbort   = null;
    this._debounceTimer = null;
    this._rateUnsub     = null;

    const customerName   = store.get('customer_name')   ?? '';
    const customerCedula = store.get('customer_cedula') ?? '';
    const cart           = store.get('cart') ?? [];

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="kiosk-body">
          ${_progressSteps(4)}

          <div class="profile-badge">
            <div class="avatar">${esc(initials(customerName))}</div>
            <div>
              <div class="profile-name">${esc(customerName)}</div>
              <div class="profile-ced">${esc(customerCedula)}</div>
            </div>
          </div>

          <!-- Search bar -->
          <div class="field-group">
            <div class="field-label">Buscar producto</div>
            <div class="search-wrap">
              <span class="search-icon">${icon('search')}</span>
              <input
                id="search-input"
                type="search"
                class="search-input"
                placeholder="Nombre o código del producto…"
                autocomplete="off"
                spellcheck="false"
              >
              <span class="search-clear" id="search-clear">✕</span>
            </div>
            <div class="search-results" id="search-results"></div>
          </div>

          <!-- Exchange-rate unavailable warning -->
          <div id="rate-warning" style="${store.get('exchange_rate_unavailable') ? '' : 'display:none'}">
            <div class="low-stock-banner">
              <span class="low-stock-banner-icon">${icon('warning')}</span>
              <span>Tipo de cambio no disponible. Los precios pueden no ser exactos.</span>
            </div>
          </div>

          <!-- Cart -->
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="section-label">Tu carrito</div>
            <div style="font-size:12px;color:var(--ft-gray-text)" id="item-count">
              ${_itemCount(cart)}
            </div>
          </div>

          <div id="cart-list">${_renderCart(cart)}</div>

          <div id="cart-summary" style="${cart.length === 0 ? 'display:none' : ''}">
            ${_renderSummary(cart)}
          </div>

          <div id="low-stock-banner" style="${_hasLowStock(cart) ? '' : 'display:none'}">
            <div class="low-stock-banner">
              <span class="low-stock-banner-icon">${icon('warning')}</span>
              <span>Uno o más productos tienen <strong>existencias limitadas</strong>. Revisa tu carrito antes de pagar.</span>
            </div>
          </div>

          <div id="stock-alert" style="display:none">
            <div class="alert-box">
              <div class="alert-icon">${icon('warning')}</div>
              <div class="alert-text" id="stock-alert-text"></div>
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <button class="btn-primary" id="btn-pay" ${cart.length === 0 ? 'disabled' : ''}>
            Ver métodos de pago →
          </button>
        </div>

        ${CONFIG.BARCODE_ENABLED ? '<input id="barcode-input" type="text" autocomplete="off" aria-hidden="true" tabindex="-1">' : ''}
      </div>
    `;

    this._wireSearch(container);
    this._wireCart(container);
    this._wirePayBtn(container);

    if (CONFIG.BARCODE_ENABLED) {
      this._wireBarcode(container);
    }

    // Wire cancel button
    container.querySelector('#cancel-btn')?.addEventListener('click', () => {
      store.clearSession();
      navigate('home');
    });

    // Subscribe to exchange rate availability — updates banner if a background
    // refresh completes (or fails) while this screen is open.
    const rateWarningEl = container.querySelector('#rate-warning');
    this._rateUnsub = store.on('exchange_rate_unavailable', (unavailable) => {
      if (rateWarningEl) rateWarningEl.style.display = unavailable ? '' : 'none';
    });
  },

  unmount() {
    clearTimeout(this._debounceTimer);
    this._searchAbort?.abort();
    this._rateUnsub?.();
    this._searchAbort   = null;
    this._debounceTimer = null;
    this._rateUnsub     = null;
  },

  // ── Text search ───────────────────────────────────────────────────

  _wireSearch(container) {
    const input     = container.querySelector('#search-input');
    const clearBtn  = container.querySelector('#search-clear');
    const resultsEl = container.querySelector('#search-results');
    const self      = this;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('visible', q.length > 0);

      clearTimeout(self._debounceTimer);

      if (q.length < 2) {
        resultsEl.classList.remove('visible');
        resultsEl.innerHTML = '';
        return;
      }

      self._debounceTimer = setTimeout(() => self._doSearch(q, container), 300);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      resultsEl.classList.remove('visible');
      resultsEl.innerHTML = '';
      input.focus();
    });

    // Collapse results on outside click
    document.addEventListener('click', (e) => {
      if (!container.querySelector('.search-wrap')?.contains(e.target)) {
        resultsEl.classList.remove('visible');
      }
    });
  },

  async _doSearch(query, container) {
    const resultsEl = container.querySelector('#search-results');
    if (!resultsEl) return;

    // Abort any previous in-flight search (text or barcode)
    this._searchAbort?.abort();
    this._searchAbort = new AbortController();
    const { signal } = this._searchAbort;

    resultsEl.innerHTML = '<div class="search-loading">Buscando…</div>';
    resultsEl.classList.add('visible');

    try {
      const products = await searchProducts(query, signal);
      if (!container.querySelector('#search-results')) return; // unmounted

      if (products.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">No se encontraron productos.</div>';
      } else {
        this._showSearchResults(products, container);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      resultsEl.innerHTML = '<div class="search-empty">Error al buscar. Intenta nuevamente.</div>';
    }
  },

  // ── Barcode scanner ───────────────────────────────────────────────

  /**
   * Wire the hidden barcode input. Called only when CONFIG.BARCODE_ENABLED.
   *
   * USB barcode scanners send characters rapidly and then an Enter key.
   * The hidden input captures this sequence. On Enter, the accumulated value
   * is treated as a barcode and searched immediately.
   *
   * Focus is maintained on the barcode input whenever no user-visible input
   * holds focus, so the scanner can fire at any time during the scan session.
   *
   * @param {HTMLElement} container
   */
  _wireBarcode(container) {
    const barcodeInput = container.querySelector('#barcode-input');
    if (!barcodeInput) return;

    // Initial focus — scanner can start firing immediately
    barcodeInput.focus();

    // Reclaim focus whenever it drifts to a non-interactive element
    barcodeInput.addEventListener('blur', () => {
      const active = document.activeElement;
      const userHasFocus =
        active &&
        active !== barcodeInput &&
        (active.tagName === 'INPUT' ||
         active.tagName === 'TEXTAREA' ||
         active.tagName === 'SELECT');
      if (!userHasFocus) {
        requestAnimationFrame(() => barcodeInput?.focus());
      }
    });

    // Trigger scan on Enter (the scanner's terminator character)
    barcodeInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const barcode = barcodeInput.value.trim();
      barcodeInput.value = '';
      if (barcode.length >= 2) {
        this._doBarcodeScan(barcode, container);
      }
    });
  },

  /**
   * Execute a barcode scan: search the catalogue and add a single result
   * directly to the cart, or show the disambiguation list for multiple matches.
   *
   * Shares _addProduct() for stock-check and cart-deduplication logic and
   * _showSearchResults() for the multi-result UI — no duplication with the
   * text-search path.
   *
   * @param {string}       barcode
   * @param {HTMLElement}  container
   */
  async _doBarcodeScan(barcode, container) {
    const resultsEl = container.querySelector('#search-results');
    if (!resultsEl) return;

    // Abort any in-flight text search
    this._searchAbort?.abort();
    this._searchAbort = new AbortController();
    const { signal } = this._searchAbort;

    resultsEl.innerHTML = '<div class="search-loading">Buscando…</div>';
    resultsEl.classList.add('visible');

    try {
      const products = await searchProducts(barcode, signal);
      if (!container.querySelector('#search-results')) return; // unmounted

      if (products.length === 0) {
        resultsEl.classList.remove('visible');
        resultsEl.innerHTML = '';
        notify('Código no encontrado en el catálogo.', 'error');
        return;
      }

      if (products.length === 1) {
        // Single unambiguous match — add to cart immediately
        resultsEl.classList.remove('visible');
        resultsEl.innerHTML = '';
        this._addProduct(products[0], container);
      } else {
        // Multiple matches — show disambiguation list for the user to pick
        this._showSearchResults(products, container);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      resultsEl.classList.remove('visible');
      resultsEl.innerHTML = '';
      notify(err.message || 'Error al leer el código. Intenta nuevamente.', 'error');
    }
  },

  // ── Shared search result renderer ─────────────────────────────────

  /**
   * Render product search results into #search-results and wire click handlers.
   * Called by both text search and barcode disambiguation — single source of
   * truth for result card HTML and add-to-cart wiring.
   *
   * @param {object[]}     products  Non-empty array of product objects
   * @param {HTMLElement}  container
   */
  _showSearchResults(products, container) {
    const resultsEl = container.querySelector('#search-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = products.map(p => `
      <div class="search-result-card" data-id="${p.id}">
        ${_productThumb(p, 'product-thumb-sm')}
        <div class="search-result-info">
          <div class="search-result-name">${esc(p.name)}</div>
          <div class="search-result-sku">SKU: ${esc(p.sku ?? '—')}</div>
        </div>
        <div class="search-result-price">${formatDual(p.unit_price)}</div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.search-result-card').forEach((card, i) => {
      card.addEventListener('click', () => {
        this._addProduct(products[i], container);
        container.querySelector('#search-input').value = '';
        container.querySelector('#search-clear')?.classList.remove('visible');
        resultsEl.classList.remove('visible');
        resultsEl.innerHTML = '';
      });
    });

    resultsEl.classList.add('visible');
  },

  // ── Cart ──────────────────────────────────────────────────────────

  _wireCart(container) {
    container.querySelector('#cart-list').addEventListener('click', async (e) => {
      const incBtn = e.target.closest('.qty-inc');
      const decBtn = e.target.closest('.qty-dec');
      const remBtn = e.target.closest('.cart-item-remove');
      if (incBtn) { await this._incrementQty(Number(incBtn.dataset.id), container); return; }
      if (decBtn) {       this._decrementQty(Number(decBtn.dataset.id), container); return; }
      if (remBtn) {
        const id = Number(remBtn.dataset.id);
        store.set('cart', (store.get('cart') ?? []).filter(i => i.id !== id));
        this._refreshCart(container);
      }
    });
  },

  _wirePayBtn(container) {
    container.querySelector('#btn-pay').addEventListener('click', async () => {
      await this._validateAndPay(container);
    });
  },

  async _incrementQty(id, container) {
    let cart = store.get('cart') ?? [];
    const item = cart.find(i => i.id === id);
    if (!item) return;
    try {
      const product = await getProduct(id);
      if (product.is_out_of_stock || item.qty >= product.current_stock) {
        notify(`【${item.name}】 Solo hay ${product.current_stock} unidades disponibles.`, 'error');
        return;
      }
      item.qty += 1;
      item.is_low_stock = product.is_low_stock || product.current_stock <= CONFIG.LOW_STOCK_THRESHOLD;
      store.set('cart', cart);
      this._refreshCart(container);
      if (item.is_low_stock) notify(`【${item.name}】 Últimas unidades disponibles.`, 'warning');
    } catch (err) {
      notify(err.message || 'Error al verificar stock.', 'error');
    }
  },

  _decrementQty(id, container) {
    const cart = store.get('cart') ?? [];
    const item = cart.find(i => i.id === id);
    if (!item || item.qty <= 1) return;
    item.qty -= 1;
    store.set('cart', cart);
    this._refreshCart(container);
  },

  _addProduct(product, container) {
    if (product.is_out_of_stock) {
      notify(`【${product.name}】 Agotado. No puede agregarse al carrito.`, 'error');
      return;
    }

    let cart = store.get('cart') ?? [];
    const existing = cart.find(item => item.id === product.id);
    const lowStock = product.is_low_stock || product.current_stock <= CONFIG.LOW_STOCK_THRESHOLD;

    if (existing) {
      // Check stock before incrementing
      if (existing.qty >= product.current_stock) {
        notify(`【${product.name}】 Solo hay ${product.current_stock} unidades disponibles.`, 'error');
        return;
      }
      existing.qty += 1;
      existing.is_low_stock = lowStock; // update in case stock changed since first add
    } else {
      cart.push({
        id:           product.id,
        sku:          product.sku ?? '',
        name:         product.name,
        image_url:    product.image_url ?? '',
        unit_price:   product.unit_price,
        qty:          1,
        is_low_stock: lowStock,
      });
    }

    store.set('cart', cart);
    this._refreshCart(container, product.id);

    if (lowStock) {
      notify(`【${product.name}】 Últimas unidades disponibles.`, 'warning');
    } else {
      notify(`${product.name} agregado al carrito.`);
    }
  },

  /**
   * Re-render cart UI after any add/remove.
   * @param {HTMLElement} container
   * @param {number}      [newItemId]  ID of the just-added product (to animate its card)
   */
  _refreshCart(container, newItemId) {
    const cart = store.get('cart') ?? [];

    container.querySelector('#cart-list').innerHTML    = _renderCart(cart);
    container.querySelector('#item-count').textContent = _itemCount(cart);

    // Animate the newly-added cart item card
    if (newItemId != null) {
      const el = container.querySelector(`.cart-item[data-id="${newItemId}"]`);
      if (el) {
        el.classList.add('new-item');
        el.addEventListener('animationend', () => el.classList.remove('new-item'), { once: true });
      }
    }

    const summaryEl = container.querySelector('#cart-summary');
    if (cart.length > 0) {
      summaryEl.style.display = '';
      summaryEl.innerHTML = _renderSummary(cart);
    } else {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
    }

    // Low-stock persistent banner
    const bannerEl = container.querySelector('#low-stock-banner');
    if (bannerEl) bannerEl.style.display = _hasLowStock(cart) ? '' : 'none';

    container.querySelector('#btn-pay').disabled = cart.length === 0;

    // Clear pre-checkout stock alert on any cart change
    container.querySelector('#stock-alert').style.display = 'none';
  },

  async _validateAndPay(container) {
    const cart = store.get('cart') ?? [];
    if (cart.length === 0) return;

    const btn = container.querySelector('#btn-pay');
    btn.disabled    = true;
    btn.textContent = 'Verificando stock…';

    const alertEl  = container.querySelector('#stock-alert');
    const alertMsg = container.querySelector('#stock-alert-text');

    // Remove any prior unavailable flags
    container.querySelectorAll('.cart-item').forEach(el => el.classList.remove('unavailable'));

    try {
      const checks = await Promise.all(
        cart.map(item => getProduct(item.id).then(p => ({ item, product: p })))
      );

      const flagged = checks.filter(({ item, product }) =>
        product.is_out_of_stock || item.qty > product.current_stock
      );

      if (flagged.length > 0) {
        alertMsg.textContent =
          'Algunos productos ya no están disponibles o cambiaron de precio. Revisa tu carrito.';
        alertEl.style.display = '';

        // Highlight flagged items
        flagged.forEach(({ item }) => {
          const el = container.querySelector(`.cart-item[data-id="${item.id}"]`);
          if (el) el.classList.add('unavailable');
        });

        btn.disabled    = false;
        btn.textContent = 'Ver métodos de pago →';
        return;
      }

      navigate('payment');
    } catch (err) {
      notify(err.message || 'Error al verificar. Intenta nuevamente.', 'error');
      btn.disabled    = false;
      btn.textContent = 'Ver métodos de pago →';
    }
  },
};

// ─── Rendering helpers ────────────────────────────────────────────────────────

/** True if any cart item was flagged as low-stock when added. */
function _hasLowStock(cart) {
  return cart.some(item => item.is_low_stock);
}

function _renderCart(cart) {
  if (cart.length === 0) {
    return '<div class="cart-empty">Aún no has agregado productos</div>';
  }
  return `<div class="cart-list">
    ${cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        ${_productThumb(item, 'cart-product-thumb')}
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(item.name)}</div>
          <div class="cart-item-detail">SKU: ${esc(item.sku)} · ${formatDual(item.unit_price)} c/u</div>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn qty-dec" data-id="${item.id}" ${item.qty <= 1 ? 'disabled' : ''} aria-label="Reducir cantidad">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn qty-inc" data-id="${item.id}" aria-label="Aumentar cantidad">+</button>
        </div>
        <div class="cart-item-price">${formatDual(Number(item.unit_price) * item.qty)}</div>
        <button class="cart-item-remove" data-id="${item.id}" aria-label="Eliminar producto">✕</button>
      </div>
    `).join('')}
  </div>`;
}

function _renderSummary(cart) {
  const total = cart.reduce((s, item) => s + Number(item.unit_price) * item.qty, 0);
  return `
    <div class="cart-summary">
      <div class="summary-row"><span>Subtotal</span><span>${formatDual(total)}</span></div>
      <div class="summary-row total">
        <span>Total a pagar</span>
        <span>${formatDual(total)}</span>
      </div>
    </div>
  `;
}

function _itemCount(cart) {
  const n = cart.reduce((s, item) => s + item.qty, 0);
  return `${n} producto${n !== 1 ? 's' : ''}`;
}

function _productThumb(product, extraClass = '') {
  const name = product?.name ?? '';
  const imageUrl = product?.image_url ?? '';
  const fallback = esc(initials(name || '?'));
  if (!imageUrl) {
    return `<div class="product-thumb ${extraClass} image-failed"><span>${fallback}</span></div>`;
  }
  return `
    <div class="product-thumb ${extraClass}">
      <img src="${esc(imageUrl)}" alt="" loading="lazy"
        onerror="this.parentElement.classList.add('image-failed')">
      <span>${fallback}</span>
    </div>
  `;
}

function _header() {
  return kioskHeader({ actionLabel: '\u2715 Cancelar', actionId: 'cancel-btn' });
}
