import { z } from 'zod';

export const checkoutContractSchema = z.object({
  orderId: z.string().min(1),
  checkoutSessionId: z.string().min(1),
  customer: z.object({
    customerId: z.string().min(1),
    email: z.string().email(),
    fullName: z.string().min(1),
    shippingAddress: z.string().min(1)
  }),
  items: z.array(z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPriceCents: z.number().int().nonnegative()
  })).min(1),
  currency: z.string().length(3),
  paymentCaptured: z.boolean(),
  acceptedAtCheckout: z.boolean(),
  acceptedAtIso: z.string().min(1)
});

export type CheckoutContractRequest = z.infer<typeof checkoutContractSchema>;
