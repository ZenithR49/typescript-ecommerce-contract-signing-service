import { describe, expect, it } from 'vitest';
import { processCheckoutContract } from '../src/checkout_contract_service.js';
import { checkoutContractSchema } from '../src/order_contract_schema.js';
import type { InfraiClient } from '../src/infrai_client.js';

function fakeInfrai(): InfraiClient {
  return {
    pdf: {
      generate: async () => ({ pdf: 'generated-pdf-base64' }),
      sign: async () => ({ pdf: 'signed-pdf-base64' })
    },
    storage: {
      object: {
        put: async (bucket: string, key: string) => ({ bucket, key }),
        presign: async () => ({ url: 'https://download.example.test/signed.pdf?token=abc' })
      }
    }
  };
}

describe('processCheckoutContract', () => {
  it('moves a paid accepted order into fulfillment before notifying the customer', async () => {
    const input = checkoutContractSchema.parse({
      orderId: 'ord_1001',
      checkoutSessionId: 'chk_2024_09_01',
      customer: {
        customerId: 'cus_77',
        email: 'buyer@example.com',
        fullName: 'Mina Lee',
        shippingAddress: '45 River St, Brooklyn, NY 11201'
      },
      items: [
        { sku: 'hoodie-olive-s', name: 'Olive Hoodie', quantity: 1, unitPriceCents: 6900 }
      ],
      currency: 'USD',
      paymentCaptured: true,
      acceptedAtCheckout: true,
      acceptedAtIso: '2024-09-01T14:22:11Z'
    });

    const result = await processCheckoutContract(input, {
      infrai: fakeInfrai(),
      signingBucket: 'signed-contracts',
      signer: {
        certPem: 'cert',
        keyPem: 'key',
        location: 'warehouse-1',
        reason: 'Order agreement accepted at checkout'
      }
    });

    expect(result.orderId).toBe('ord_1001');
    expect(result.finalStatus).toBe('customer_notified');
    expect(result.timeline.map((event) => event.status)).toEqual([
      'checkout_confirmed',
      'contract_signed',
      'fulfillment_ready',
      'receipt_sent',
      'customer_notified'
    ]);
    expect(result.signedObjectKey).toBe('orders/ord_1001/contract-chk_2024_09_01.pdf');
    expect(result.receiptUrl).toContain('signed.pdf');
  });
});
