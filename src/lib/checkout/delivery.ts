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

const checkoutDeliveryRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  addressId: z.string().uuid().nullable(),
  address: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(100).optional(),
  district: z.string().trim().min(1).max(100).optional(),
  ward: z.string().trim().min(1).max(100).optional(),
}).strict();

const checkoutVatSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  taxCode: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(500),
}).strict();

export const checkoutRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  delivery: checkoutDeliveryRequestSchema,
  vat: checkoutVatSchema.nullable(),
}).strict();

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const accountCheckoutSchema = checkoutDeliverySchema.extend({
  idempotencyKey: z.string().uuid(),
}).strict();

export type AccountCheckoutInput = z.infer<typeof accountCheckoutSchema>;
