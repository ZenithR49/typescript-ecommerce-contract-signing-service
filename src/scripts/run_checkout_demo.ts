import { createInfraiClient } from '../infrai_client.js';
import { checkoutContractSchema } from '../order_contract_schema.js';
import { processCheckoutContract } from '../checkout_contract_service.js';

const infrai = createInfraiClient();

const demoInput = checkoutContractSchema.parse({
  orderId: 'ord_1001',
  checkoutSessionId: 'chk_2024_09_01',
  customer: {
    customerId: 'cus_77',
    email: 'buyer@example.com',
    fullName: 'Mina Lee',
    shippingAddress: '45 River St, Brooklyn, NY 11201'
  },
  items: [
    { sku: 'hoodie-olive-s', name: 'Olive Hoodie', quantity: 1, unitPriceCents: 6900 },
    { sku: 'sock-black', name: 'Black Socks', quantity: 2, unitPriceCents: 1200 }
  ],
  currency: 'USD',
  paymentCaptured: true,
  acceptedAtCheckout: true,
  acceptedAtIso: '2024-09-01T14:22:11Z'
});

const result = await processCheckoutContract(demoInput, {
  infrai,
  signingBucket: process.env.SIGNED_CONTRACT_BUCKET || 'signed-contracts',
  signer: {
    certPem: process.env.SIGNING_CERT_PEM || '',
    keyPem: process.env.SIGNING_KEY_PEM || '',
    location: 'warehouse-1',
    reason: 'Order agreement accepted at checkout'
  }
});

console.log(JSON.stringify(result, null, 2));
