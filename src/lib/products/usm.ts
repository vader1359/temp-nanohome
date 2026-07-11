type UsmVariant = {
  readonly sku: string | null;
  readonly stock: number | null;
};

const USM_SKU_PREFIX = "USMUS";

export function isUsmVariant(variant: UsmVariant): boolean {
  return variant.sku?.startsWith(USM_SKU_PREFIX) === true;
}

export function isUsmContactVariant(variant: UsmVariant): boolean {
  return isUsmVariant(variant) && (variant.stock === null || variant.stock <= 0);
}
