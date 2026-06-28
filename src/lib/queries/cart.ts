import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Cart, CartItem, TypedSupabaseClient } from "@/types/db";

export type GuestCartItem = {
  readonly variantId: string;
  readonly quantity: number;
  readonly guestId?: string;
};

export async function getCart(userId: string): Promise<Cart | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("carts").select("*").eq("user_id", userId).maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function createCart(userId: string): Promise<Cart> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("carts").insert([{ user_id: userId }]).select("*").single();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function getCartItems(cartId: string): Promise<readonly CartItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("*, variants(*)")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return data ?? [];
}

export async function addCartItem(cartId: string, variantId: string, qty: number): Promise<CartItem> {
  assertPositiveQuantity(qty);
  const supabase = await createClient();
  return upsertCartItemQuantity(supabase, cartId, variantId, qty);
}

export async function updateCartItemQuantity(cartItemId: string, qty: number): Promise<CartItem> {
  assertPositiveQuantity(qty);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity: qty })
    .eq("id", cartItemId)
    .select("*")
    .single();

  if (error !== null) {
    throw error;
  }

  return data;
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);

  if (error !== null) {
    throw error;
  }
}

export async function mergeGuestCart(userId: string, guestItems: readonly GuestCartItem[]): Promise<Cart> {
  for (const item of guestItems) {
    assertPositiveQuantity(item.quantity);
  }

  const supabase = createAdminClient();
  const cart = await getOrCreateCartWithAdmin(supabase, userId);
  const guestId = guestItems.find((item) => item.guestId !== undefined)?.guestId;

  if (guestId !== undefined && cart.merged_from_guest_id === guestId) {
    return cart;
  }

  for (const item of guestItems) {
    await upsertCartItemQuantity(supabase, cart.id, item.variantId, item.quantity);
  }

  if (guestId === undefined) {
    return cart;
  }

  const { data, error } = await supabase
    .from("carts")
    .update({ merged_from_guest_id: guestId })
    .eq("id", cart.id)
    .select("*")
    .single();

  if (error !== null) {
    throw error;
  }

  return data;
}

function assertPositiveQuantity(qty: number): void {
  if (!Number.isInteger(qty) || qty < 1) {
    throw new RangeError("quantity must be a positive integer");
  }
}

async function getOrCreateCartWithAdmin(supabase: TypedSupabaseClient, userId: string): Promise<Cart> {
  const { data: existing, error: selectError } = await supabase.from("carts").select("*").eq("user_id", userId).maybeSingle();

  if (selectError !== null) {
    throw selectError;
  }

  if (existing !== null) {
    return existing;
  }

  const { data, error } = await supabase.from("carts").insert([{ user_id: userId }]).select("*").single();
  if (error !== null) {
    throw error;
  }

  return data;
}

async function upsertCartItemQuantity(
  supabase: TypedSupabaseClient,
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartItem> {
  const { data: existing, error: selectError } = await supabase
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId)
    .maybeSingle();

  if (selectError !== null) {
    throw selectError;
  }

  if (existing === null) {
    const { data, error } = await supabase
      .from("cart_items")
      .insert([{ cart_id: cartId, variant_id: variantId, quantity }])
      .select("*")
      .single();
    if (error !== null) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity: existing.quantity + quantity })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error !== null) {
    throw error;
  }

  return data;
}
