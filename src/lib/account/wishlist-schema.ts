import { z } from "zod";

const variantIdSchema = z.string().trim().min(1).max(128);
const wishlistItemSchema = z.object({ variantId: variantIdSchema }).strict();
const guestMergeSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
  variantIds: z.array(variantIdSchema).max(50),
}).strict();

export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
export type GuestWishlistMergeInput = z.infer<typeof guestMergeSchema>;

export function parseWishlistItem(value: unknown): WishlistItemInput | null {
  const parsed = wishlistItemSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseGuestWishlistMerge(value: unknown): GuestWishlistMergeInput | null {
  const parsed = guestMergeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
