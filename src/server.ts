import { createServer } from 'node:http';
import { createInfraiClient, InfraiError } from './infrai_client.js';
import { checkoutContractSchema } from './order_contract_schema.js';
import { processCheckoutContract } from './checkout_contract_service.js';

const infrai = createInfraiClient();

function json(status: number, body: unknown) {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/checkout-contract') {
    const response = json(404, { message: 'Not found' });
    res.writeHead(response.status, response.headers);
    res.end(response.body);
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const parsed = checkoutContractSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));

    const result = await processCheckoutContract(parsed, {
      infrai,
      signingBucket: process.env.SIGNED_CONTRACT_BUCKET || 'signed-contracts',
      signer: {
        certPem: process.env.SIGNING_CERT_PEM || '',
        keyPem: process.env.SIGNING_KEY_PEM || '',
        location: 'warehouse-1',
        reason: 'Order agreement accepted at checkout'
      }
    });

    const response = json(201, result);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  } catch (error) {
    if ((error as { name?: string }).name === 'ZodError') {
      const response = json(400, { message: 'Invalid request body' });
      res.writeHead(response.status, response.headers);
      res.end(response.body);
      return;
    }

    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      const response = json(status, { message: error.message, details: error.details });
      res.writeHead(response.status, response.headers);
      res.end(response.body);
      return;
    }

    const response = json(500, { message: 'Unexpected server error' });
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Checkout contract service listening on http://localhost:${port}`);
});
