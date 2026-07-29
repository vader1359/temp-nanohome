import { z } from "zod";

export const checkoutDeliverySchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().min(1).max(100).optional(),
  ward: z.string().trim().min(1).max(100).optional(),
  note: z.string().trim().min(1).max(1_000).optional(),
}).strict();

export type CheckoutDelivery = z.infer<typeof checkoutDeliverySchema>;

export const accountCheckoutSchema = checkoutDeliverySchema.extend({
  idempotencyKey: z.string().uuid(),
}).strict();

export type AccountCheckoutInput = z.infer<typeof accountCheckoutSchema>;
