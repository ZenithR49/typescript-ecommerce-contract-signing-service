import type { CheckoutContractRequest } from './order_contract_schema.js';

export type OrderStatus =
  | 'checkout_confirmed'
  | 'contract_signed'
  | 'fulfillment_ready'
  | 'receipt_sent'
  | 'customer_notified'
  | 'manual_review';

export type OrderEvent = {
  status: OrderStatus;
  note: string;
};

export function buildOrderTimeline(input: CheckoutContractRequest): OrderEvent[] {
  const timeline: OrderEvent[] = [
    { status: 'checkout_confirmed', note: `Checkout session ${input.checkoutSessionId} confirmed` },
    { status: 'contract_signed', note: `Signed agreement recorded for ${input.orderId}` }
  ];

  if (input.paymentCaptured && input.acceptedAtCheckout) {
    timeline.push({ status: 'fulfillment_ready', note: 'Payment captured and terms accepted' });
  } else {
    timeline.push({ status: 'manual_review', note: 'Needs payment or acceptance review' });
  }

  timeline.push(
    { status: 'receipt_sent', note: `Receipt queued for ${input.customer.email}` },
    { status: 'customer_notified', note: `Customer update sent for ${input.orderId}` }
  );

  return timeline;
}
