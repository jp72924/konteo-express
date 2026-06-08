/**
 * store.js — in-memory pub/sub store with sessionStorage persistence.
 *
 * Keys in PERSISTED_KEYS are automatically synced to sessionStorage so that
 * a page refresh within the same tab restores the session.
 *
 * Cart items shape: { id, sku, name, unit_price, qty }
 */

const PERSISTED_KEYS = [
  'customer_id',
  'customer_name',
  'customer_cedula',
  'order_id',
  'order_number',
  'payment_number',
  'payment_status',
  'cart',
];

class Store {
  constructor() {
    /** @type {Record<string, any>} */
    this._data = {};
    /** @type {Record<string, Function[]>} */
    this._listeners = {};

    // Restore persisted data from sessionStorage
    for (const key of PERSISTED_KEYS) {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) {
        try {
          this._data[key] = JSON.parse(raw);
        } catch {
          this._data[key] = raw;
        }
      }
    }
  }

  /** Get a stored value. Returns undefined if not set. */
  get(key) {
    return this._data[key];
  }

  /** Set a value and notify subscribers. Persists to sessionStorage if applicable. */
  set(key, value) {
    this._data[key] = value;
    if (PERSISTED_KEYS.includes(key)) {
      sessionStorage.setItem(key, JSON.stringify(value));
    }
    const fns = this._listeners[key];
    if (fns) fns.forEach(fn => fn(value));
  }

  /**
   * Subscribe to changes for a key.
   * @returns {() => void} unsubscribe function
   */
  on(key, fn) {
    (this._listeners[key] ??= []).push(fn);
    return () => {
      this._listeners[key] = (this._listeners[key] ?? []).filter(f => f !== fn);
    };
  }

  /**
   * Clear all persisted session data for the current customer transaction.
   * Nothing needs to be preserved between sessions — the station API key
   * lives in CONFIG, not in sessionStorage.
   */
  clearSession() {
    for (const key of PERSISTED_KEYS) {
      delete this._data[key];
      sessionStorage.removeItem(key);
    }
  }

  /** Hard reset — clears everything including the token. Used on fatal errors. */
  clearAll() {
    for (const key of PERSISTED_KEYS) {
      delete this._data[key];
      sessionStorage.removeItem(key);
    }
  }
}

export const store = new Store();
