import type { CheckoutContractRequest } from './order_contract_schema.js';

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function renderContractHtml(input: CheckoutContractRequest): string {
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const rows = input.items.map((item) => `
    <tr>
      <td>${item.sku}</td>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.unitPriceCents, input.currency)}</td>
      <td>${formatMoney(item.quantity * item.unitPriceCents, input.currency)}</td>
    </tr>
  `).join('');

  return `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        p { line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        .meta { margin-top: 24px; }
      </style>
    </head>
    <body>
      <h1>Order agreement</h1>
      <p>This contract confirms checkout acceptance for order <strong>${input.orderId}</strong>.</p>
      <p>Customer: ${input.customer.fullName} (${input.customer.email})</p>
      <p>Ship to: ${input.customer.shippingAddress}</p>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="meta">
        <p>Subtotal: <strong>${formatMoney(subtotal, input.currency)}</strong></p>
        <p>Accepted at checkout: ${input.acceptedAtCheckout ? 'yes' : 'no'}</p>
        <p>Accepted at: ${input.acceptedAtIso}</p>
        <p>Checkout session: ${input.checkoutSessionId}</p>
      </div>
    </body>
  </html>`;
}
