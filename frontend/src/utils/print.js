/**
 * Prints arbitrary receipt-style HTML via a hidden iframe and the
 * browser's native print dialog. Deliberately NOT tied to any specific
 * printer brand/SDK — whatever printer is set as the system default
 * (thermal receipt printer, a regular office printer, "Save as PDF")
 * handles it the same way a person printing from any other website
 * would experience, which is what "works regardless of which printer"
 * actually means in a browser context.
 */
export function printReceipt(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Give the iframe a tick to lay out the content before invoking print
  // — calling print() immediately after write() can catch some browsers
  // mid-render and produce a blank page.
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  // Fallback in case onload doesn't fire (some browsers with `write`).
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      /* already printed via onload, or iframe was removed */
    }
  }, 300);

  // Clean up well after the print dialog would have appeared — printing
  // is a blocking OS dialog on most platforms, so this is safe.
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 60000);
}

const RECEIPT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
    padding: 12px;
    color: #000;
    font-size: 13px;
  }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  .muted { color: #444; font-size: 11px; }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .items { margin: 8px 0; }
  .item-line { margin-bottom: 4px; }
  .total-row { font-weight: bold; font-size: 14px; }
  @media print {
    @page { margin: 4mm; }
  }
`;

/**
 * Kitchen Order Ticket — printed the moment an order lands in the
 * kitchen, regardless of source (QR scan or a waiter's manual entry).
 */
export function buildKotHtml(order) {
  const items = (order.items || []).filter((i) => i.status !== 'CANCELLED');
  const itemsHtml = items
    .map((item) => {
      const portion = item.portion === 'HALF' ? ' (Half)' : '';
      const modifiers = item.modifiers?.length
        ? `<div class="muted">&nbsp;&nbsp;${item.modifiers.map((m) => m.modifierOption?.name).join(', ')}</div>`
        : '';
      const notes = item.notes ? `<div class="muted">&nbsp;&nbsp;Note: ${escapeHtml(item.notes)}</div>` : '';
      return `<div class="item-line"><div class="row"><span>${item.quantity}x ${escapeHtml(
        item.menuItem?.name || 'Item'
      )}${portion}</span></div>${modifiers}${notes}</div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><title>KOT</title><style>${RECEIPT_STYLES}</style></head><body>
    <h1>KOT</h1>
    <p class="center muted">${order.source === 'WAITER_MANUAL' ? 'Manual Order' : 'QR Order'}${
    order.orderType === 'PARCEL' ? ' — PARCEL' : ''
  }</p>
    <div class="divider"></div>
    <div class="row"><strong>Table ${escapeHtml(String(order.table?.tableNumber ?? '—'))}</strong>
      <span class="muted">${new Date(order.placedAt).toLocaleTimeString()}</span></div>
    <div class="divider"></div>
    <div class="items">${itemsHtml}</div>
  </body></html>`;
}

/**
 * The customer-facing bill — printed by a waiter (or the Owner) at
 * checkout, itemizing every order placed during the whole sitting, not
 * just the most recent one, since a table's dining session can span
 * several separate orders before the bill is requested.
 */
export function buildBillHtml({ restaurant, table, orders }) {
  let subtotal = 0;
  let tax = 0;
  const rows = orders
    .flatMap((o) => o.items || [])
    .filter((i) => i.status !== 'CANCELLED')
    .map((item) => {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      return `<div class="row item-line"><span>${item.quantity}x ${escapeHtml(item.menuItem?.name || 'Item')}${
        item.portion === 'HALF' ? ' (Half)' : ''
      }</span><span>₹${lineTotal.toFixed(2)}</span></div>`;
    })
    .join('');

  orders.forEach((o) => {
    subtotal += Number(o.subtotal || 0);
    tax += Number(o.taxAmount || 0);
  });
  const total = subtotal + tax;

  return `<!DOCTYPE html><html><head><title>Bill</title><style>${RECEIPT_STYLES}</style></head><body>
    <h1>${escapeHtml(restaurant?.name || 'Bill')}</h1>
    <p class="center muted">Table ${escapeHtml(String(table?.tableNumber ?? '—'))}</p>
    <div class="divider"></div>
    <div class="items">${rows}</div>
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    ${tax > 0 ? `<div class="row"><span>Tax</span><span>₹${tax.toFixed(2)}</span></div>` : ''}
    <div class="divider"></div>
    <div class="row total-row"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
    <div class="divider"></div>
    <p class="center muted">Thank you for dining with us!</p>
  </body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
