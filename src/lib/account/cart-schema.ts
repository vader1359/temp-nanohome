import { z } from "zod";

const variantId = z.string().trim().min(1).max(80);
const quantity = z.number().int().min(1).max(10);
const expectedVersion = z.number().int().min(0);

const cartMutationSchema = z.object({ expectedVersion, quantity, variantId }).strict();
const cartRemovalSchema = z.object({ expectedVersion, variantId }).strict();
const guestCartMergeSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  items: z.array(z.object({ quantity, variantId }).strict()).min(1).max(50),
}).strict();

export type CartMutationInput = z.infer<typeof cartMutationSchema>;
export type CartRemovalInput = z.infer<typeof cartRemovalSchema>;
export type GuestCartMergeInput = z.infer<typeof guestCartMergeSchema>;

export function parseCartMutation(value: unknown): CartMutationInput | null {
  const parsed = cartMutationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseCartRemoval(value: unknown): CartRemovalInput | null {
  const parsed = cartRemovalSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseGuestCartMerge(value: unknown): GuestCartMergeInput | null {
  const parsed = guestCartMergeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
