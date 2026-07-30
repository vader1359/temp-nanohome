import type { AccountCart } from "@/lib/account/cart-port";

export type CartCheckoutReadiness =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "ready" }>
  | Readonly<{
      kind: "stock_changed";
      changedItems: readonly Readonly<{
        quantity: number;
        title: string;
        variantId: string;
      }>[];
    }>
  | Readonly<{
      kind: "unavailable_items";
      unavailableItems: readonly Readonly<{
        quantity: number;
        title: string;
        variantId: string;
      }>[];
    }>;

export type CartCheckoutReadinessOptions = Readonly<{
  stockChangedVariantIds?: readonly string[];
}>;

export function cartCheckoutReadiness(
  cart: AccountCart,
  options: CartCheckoutReadinessOptions = {},
): CartCheckoutReadiness {
  if (cart.items.length === 0) return { kind: "empty" };

  const stockChangedIds = new Set(options.stockChangedVariantIds ?? []);
  const changedItems = cart.items
    .filter((item) => stockChangedIds.has(item.variantId))
    .map(({ quantity, title, variantId }) => ({ quantity, title, variantId }));
  if (changedItems.length > 0) return { changedItems, kind: "stock_changed" };

  const unavailableItems = cart.items
    .filter((item) => !item.available)
    .map(({ quantity, title, variantId }) => ({ quantity, title, variantId }));

  return unavailableItems.length > 0
    ? { kind: "unavailable_items", unavailableItems }
    : { kind: "ready" };
}
