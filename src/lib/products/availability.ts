type StockedVariant = { readonly stock: number | null };

/** The AMIS inventory balance is the sole availability source of truth. */
export function isInStock(variant: StockedVariant): boolean {
  return variant.stock !== null && Number(variant.stock) > 0;
}
