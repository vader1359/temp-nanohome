import type { Variant } from "@/types/db";

function variantText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function variantDetailHref(variant: Pick<Variant, "id" | "slug" | "slug_vi">): string {
  const detailSlug = variantText(variant.slug_vi, variantText(variant.slug, variant.id));
  return `/products/${encodeURIComponent(detailSlug)}`;
}
