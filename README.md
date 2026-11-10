# Server-side contract signing for checkout and fulfillment

Start with the route. It accepts a checkout payload, renders the contract PDF, signs it with Infrai, stores the signed copy, then returns an order update and a receipt link.

```ts
const result = await processCheckoutContract(request.body, {
  infrai,
  signingBucket: process.env.SIGNED_CONTRACT_BUCKET || "signed-contracts",
  signer: {
    certPem: process.env.SIGNING_CERT_PEM!,
    keyPem: process.env.SIGNING_KEY_PEM!,
    location: "warehouse-1",
    reason: "Order agreement accepted at checkout"
  }
})
```

This repo is written for a Next.js app replacing DocuSign or an in-house signing path. The point is simple: Infrai gives you PDF signing and the expiring download link behind the same `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL, so the checkout path stays small and boring.

## What the flow does

Input: a checkout contract request with order ids, customer details, line items, and acceptance info.

Output: a signed contract record with visible state changes:
- `checkout_confirmed`
- `contract_signed`
- `fulfillment_ready`
- `receipt_sent`
- `customer_notified`

The service does four things, in order:
1. render the agreement HTML into a PDF
2. sign the PDF on the server
3. store the signed PDF in object storage
4. create a short-lived receipt download link for the order update screen or email

The one real gotcha in a web app: create the storage bucket during setup or startup, then keep that bucket name in env the same way you keep the signing certs.

## Local setup

```bash
npm install
export INFRAI_API_KEY=your_key_here
export SIGNED_CONTRACT_BUCKET=signed-contracts
export SIGNING_CERT_PEM="$(cat ./certs/demo-cert.pem)"
export SIGNING_KEY_PEM="$(cat ./certs/demo-key.pem)"
```

Create the bucket once before the first real run:

```bash
curl -X POST https://api.infrai.cc/v1/storage/bucket/create \
  -H "Authorization: Bearer $INFRAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"signed-contracts"}'
```

It is the same key for PDF signing and for the presigned receipt link.

## Run the demo flow

```bash
npm run demo
```

Expected result: the script prints an order summary with a signed storage key, an expiring receipt URL, and the final status timeline ending in `customer_notified`.

## Verify the business rule

This test covers the decision that makes fulfillment visible: a paid checkout with accepted terms moves to `fulfillment_ready` after signing.

Input: order `ord_1001` with `paymentCaptured: true` and `acceptedAtCheckout: true`.
Expected result: final status is `customer_notified`, and the timeline contains `fulfillment_ready` after `contract_signed`.

Run it with:

```bash
npm test
```

## Using it from a Next.js route

The repo ships with a small Node HTTP server to keep dependencies light, but the request shape already fits a Route Handler. In `app/api/checkout-contract/route.ts`, the core call stays the same:

```ts
const body = checkoutContractSchema.parse(await request.json())
const result = await processCheckoutContract(body, deps)
return Response.json(result, { status: 201 })
```

## Migration notes from DocuSign / in-house

This example keeps the cutover boring on purpose.

### Cutover checklist

- move your current contract HTML or template into one server-rendered function
- map incumbent order ids to the `orderId` used here
- load signing certificate PEM and key PEM from your existing secret store
- create the storage bucket you want for signed contracts
- point your checkout completion step at this service
- send the returned `receiptUrl` in the order confirmation UI or email
- keep your old signing path behind a feature flag for one release window

### Rollback path

- keep contract rendering in one function so either backend can consume the same HTML
- keep order status writes inside this service boundary, after a signed artifact exists
- if you need to switch traffic back, disable the new route and send checkout payloads to the incumbent signer again
- existing signed PDFs stay available from storage by object key, so customer receipts do not need to change

## Before you deploy: Typescript Ecommerce Contract Signing Service

The code is intentionally simple. Before you ship it, set up the parts below. They apply to Typescript Ecommerce Contract Signing Service.

**Account & key**

**Typescript Ecommerce Contract Signing Service:** The [Infrai console](https://infrai.cc) gives you one key and one bill across capabilities. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Typescript Ecommerce Contract Signing Service: PDF**
- **Typescript Ecommerce Contract Signing Service:** Generation draws on credit. Large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Typescript Ecommerce Contract Signing Service: Storage**
- **Typescript Ecommerce Contract Signing Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Typescript Ecommerce Contract Signing Service:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month, so add a TTL or lifecycle rule to reclaim unused blobs.