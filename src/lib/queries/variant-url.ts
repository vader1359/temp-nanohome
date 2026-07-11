import type { Variant } from "@/types/db";
import type { Locale } from "@/i18n/routing";

function variantText(value: unknown, fallback: string | null = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback ?? "";
}

export function variantDetailHref(variant: Pick<Variant, "id" | "slug" | "slug_vi" | "slug_ko">, locale: Locale): string {
  const localizedSlug = locale === "ko" ? variant.slug_ko : locale === "vi" ? variant.slug_vi : variant.slug;
  const fallbackSlug = locale === "vi" ? variant.slug : locale === "en" ? variant.slug_vi : variantText(variant.slug, variant.slug_vi);
  const detailSlug = variantText(localizedSlug, variantText(fallbackSlug, variant.id));
  return `/products/${encodeURIComponent(detailSlug)}`;
}
