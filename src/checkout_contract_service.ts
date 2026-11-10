import { renderContractHtml } from './contract_html.js';
import type { InfraiClient } from './infrai_client.js';
import { buildOrderTimeline } from './order_updates.js';
import type { CheckoutContractRequest } from './order_contract_schema.js';

export type CheckoutContractDeps = {
  infrai: InfraiClient;
  signingBucket: string;
  signer: {
    certPem: string;
    keyPem: string;
    reason: string;
    location: string;
  };
};

export type CheckoutContractResult = {
  orderId: string;
  signedObjectKey: string;
  receiptUrl: string;
  finalStatus: string;
  timeline: ReturnType<typeof buildOrderTimeline>;
};

function toBase64Utf8(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

export async function processCheckoutContract(input: CheckoutContractRequest, deps: CheckoutContractDeps): Promise<CheckoutContractResult> {
  const html = renderContractHtml(input);
  const generated = await deps.infrai.pdf.generate({
    html,
    page_size: 'A4',
    orientation: 'portrait',
    store: false
  });

  const signed = await deps.infrai.pdf.sign({
    pdf: generated.pdf,
    cert_pem: deps.signer.certPem,
    key_pem: deps.signer.keyPem,
    reason: deps.signer.reason,
    location: deps.signer.location,
    retention_days: 30
  });

  const signedObjectKey = `orders/${input.orderId}/contract-${input.checkoutSessionId}.pdf`;

  await deps.infrai.storage.object.put(deps.signingBucket, signedObjectKey, {
    data_base64: signed.pdf,
    content_type: 'application/pdf'
  });

  const presigned = await deps.infrai.storage.object.presign(deps.signingBucket, signedObjectKey, {
    op: 'get',
    expires_seconds: 3600,
    response_disposition: `attachment; filename="${input.orderId}-signed-contract.pdf"`,
    idempotency_key: toBase64Utf8(`${input.orderId}:${input.checkoutSessionId}:receipt-link`)
  });

  const timeline = buildOrderTimeline(input);
  const finalStatus = timeline[timeline.length - 1].status;

  return {
    orderId: input.orderId,
    signedObjectKey,
    receiptUrl: presigned.url,
    finalStatus,
    timeline
  };
}
