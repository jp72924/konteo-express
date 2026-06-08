/**
 * SuccessScreen.js — Transaction complete / receipt screen.
 *
 * Displays:
 * - Success animation
 * - Customer name
 * - Order number and payment number
 * - Cart items summary
 * - Total paid
 * - "Nueva compra" button (clears session, returns to home)
 *
 * Auto-returns to home after 30 seconds of inactivity (handled by main.js idle timer).
 */

import { CONFIG }   from '../config.js';
import { store }    from '../store.js';
import { navigate } from '../router.js';
import { formatDual } from '../currency.js';
import { esc, kioskHeader, icon } from './utils.js';

export const SuccessScreen = {
  mount(container, _params = {}) {
    const orderNumber  = store.get('order_number')  ?? '—';
    const paymentNumber = store.get('payment_number') ?? '—';
    const paymentStatus = store.get('payment_status') ?? 'confirmed';
    const customerName = store.get('customer_name')  ?? '—';
    const cart         = store.get('cart') ?? [];

    const totalUsd = cart.reduce((s, item) => s + Number(item.unit_price) * item.qty, 0);
    const now       = new Date();
    const dateStr   = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr   = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const pendingReview = paymentStatus === 'pending_review';

    const itemRows = cart.map(item => `
      <div class="ticket-row">
        <span>${esc(item.name)}${item.qty > 1 ? ` ×${item.qty}` : ''}</span>
        <span>${formatDual(Number(item.unit_price) * item.qty)}</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="screen active">
        ${_header()}

        <div class="kiosk-body">
          <div class="success-icon">${icon('check')}</div>

          <div class="text-center">
            <div class="screen-title">${pendingReview ? 'Pago registrado' : '¡Pago exitoso!'}</div>
            <div class="screen-sub">Gracias por tu compra, ${esc(customerName.split(' ')[0])}</div>
          </div>

          <div class="ticket-preview">
            <div class="ticket-header">
              <div class="ticket-store">${esc(CONFIG.STORE_NAME)}</div>
              <div style="font-size:11px;color:var(--ft-gray-text);margin-top:2px">
                ${esc(CONFIG.STORE_ADDRESS)}
              </div>
              <div style="font-size:11px;color:var(--ft-gray-text);margin-top:2px">
                ${dateStr} · ${timeStr}
              </div>
            </div>

            ${itemRows}

            <div class="ticket-total">
              <span>${pendingReview ? 'Total registrado' : 'Total pagado'}</span>
              <span>${formatDual(totalUsd)}</span>
            </div>

            <div class="ticket-code">
              Pedido: ${esc(orderNumber)}<br>
              Pago: ${esc(paymentNumber)}<br>
              Nro. de caja RetailOps Kiosk #${esc(CONFIG.KIOSK_STATION_NUMBER)}
            </div>
          </div>

          <div class="text-muted">
            ${pendingReview
              ? 'Tu comprobante quedo pendiente de revision. Un asociado puede ayudarte si lo necesitas.'
              : 'Puedes retirarte con tus productos. ¡Hasta pronto!'}
          </div>
        </div>

        <div class="bottom-bar">
          <button class="btn-primary" id="btn-new">Nueva compra</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-new').addEventListener('click', () => {
      store.clearSession();
      navigate('home');
    });
  },

  unmount() {},
};

function _header() {
  return kioskHeader({ emptyRight: true });
}
