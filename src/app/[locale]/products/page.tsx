import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/products/products-page";
import type { ProductGridItem, ProductStatusKind } from "@/components/products/ProductGrid";
import { getBrands } from "@/lib/queries/brands";
import { getVariantProducts, type VariantProductListItem } from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";
import type { Variant } from "@/types/db";
import type { Locale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

const NUMBER_FORMAT_LOCALE: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
  ko: "ko-KR",
};

function priceFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(NUMBER_FORMAT_LOCALE[locale], {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function variantText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function variantRawText(variant: VariantProductListItem, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText(raw[key]);
}

function getVariantImageUrl(variant: VariantProductListItem): string {
  return (
    variantRawText(variant, "cldr_packshot_url") ||
    variantRawText(variant, "cldr_packshot") ||
    variantText(variant.packshot_url) ||
    variant.gallery_urls[0] ||
    "/images/p_lc2.png"
  );
}

/**
 * Pick the locale-specific finish label for the product subtitle.
 * Only `finish` (English/primary) and `finish_vi` exist in the data model.
 * For Vietnamese prefer `finish_vi` then fall back to `finish`; for any other
 * locale prefer `finish` then fall back to `finish_vi` so we never show an
 * empty subtitle when one of the two columns has data.
 */
function resolveFinishLabel(variant: VariantProductListItem, locale: Locale): string {
  if (locale === "vi") {
    return variantText(variant.finish_vi, variantText(variant.finish));
  }

  return variantText(variant.finish, variantText(variant.finish_vi));
}

export default async function ProductsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Products");
  // Narrow the route param to a supported locale. The [locale] segment is
  // guarded by the layout's `isSupportedLocale` check, so an unsupported value
  // never reaches this server component.
  const supportedLocale: Locale = locale as Locale;

  const numberFormat = priceFormatter(supportedLocale);
  const defaultName = t("defaultProductName");

  function formatPrice(price: Variant["price"]): string {
    if (price === null) {
      return t("contactForPrice");
    }

    return numberFormat.format(Number(price));
  }

  function variantToGridItem(variant: VariantProductListItem): ProductGridItem {
    const imageUrl = getVariantImageUrl(variant);
    const discount = variant.discount_percent !== null ? `-${variant.discount_percent}%` : null;
    const name = variantText(variant.name, defaultName);
    const subtitle =
      [resolveFinishLabel(variant, supportedLocale), variantText(variant.size)]
        .filter(Boolean)
        .join(" / ") || defaultName;
    const status: ProductStatusKind = variant.on_sale
      ? "sale"
      : variant.in_stock
        ? "in_stock"
        : "out_of_stock";

    return {
      id: variant.id,
      brand: "nanoHome",
      name,
      subtitle,
      status,
      imageUrl,
      href: variantDetailHref(variant),
      oldPrice: variant.compare_at_price !== null ? formatPrice(variant.compare_at_price) : null,
      discount,
      price: formatPrice(variant.price),
      swatches: [],
    };
  }

  const [variants, brands] = await Promise.all([
    getVariantProducts({ pageSize: 24 }),
    getBrands(),
  ]);
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const products = variants.map(variantToGridItem);

  return (
    <ProductsPage
      brands={brands.map(({ id, logo_url, name }) => ({ id, logoUrl: logo_url, name }))}
      products={products.map((product, index) => ({
        ...product,
        brand: brandById.get(variants[index]?.brand_id ?? "")?.name ?? product.brand,
        brandLogoUrl: brandById.get(variants[index]?.brand_id ?? "")?.logo_url ?? null,
      }))}
    />
  );
}