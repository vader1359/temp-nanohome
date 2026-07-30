import type { ProductGridItem } from "@/components/products/product-grid-item";
import type { PublicChatLocale } from "@/lib/chat/contracts";
import type { PublicChatSafeProduct } from "@/lib/chat/stream-events";

export type ProductCardAdaptation =
  | { ok: true; product: ProductGridItem }
  | {
      ok: false;
      reason:
        | "missing_brand"
        | "missing_image"
        | "missing_link"
        | "invalid_price"
        | "invalid_stock";
    };

export type ProductCardSkip = Readonly<{
  variantId: string;
  reason: Exclude<ProductCardAdaptation, { ok: true }>["reason"];
}>;

export type ProductCardAdaptationSummary = Readonly<{
  products: readonly ProductGridItem[];
  skipped: readonly ProductCardSkip[];
}>;

const numberLocale: Record<PublicChatLocale, string> = {
  vi: "vi-VN",
  en: "en-US",
  ko: "ko-KR",
};

const priceCopy: Record<PublicChatLocale, { contact: string; unavailable: string }> = {
  vi: { contact: "Liên hệ", unavailable: "Chưa có giá công khai" },
  en: { contact: "Contact for price", unavailable: "No public price" },
  ko: { contact: "가격 문의", unavailable: "공개 가격 없음" },
};

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function relativeCanonicalLink(value: string | undefined): value is string {
  return nonEmpty(value) && /^\/(?!\/)/.test(value) && !value.includes("\\");
}

function formatFixedPrice(amount: number, currency: string, locale: PublicChatLocale): string | null {
  if (!Number.isFinite(amount) || amount <= 1 || !nonEmpty(currency)) return null;

  try {
    return new Intl.NumberFormat(numberLocale[locale], {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return null;
  }
}

function subtitleFromAttributes(attributes: Readonly<Record<string, string>> | undefined): string {
  const values = [attributes?.designer, attributes?.collection, attributes?.category]
    .map((value) => value?.trim())
    .filter((value): value is string => nonEmpty(value));

  return [...new Set(values)].join(" · ");
}

function priceFromSafeProduct(product: PublicChatSafeProduct, locale: PublicChatLocale): string | null {
  if (product.price?.mode === "fixed") {
    return formatFixedPrice(product.price.amount, product.price.currency, locale);
  }

  if (product.price?.mode === "contact") return priceCopy[locale].contact;
  if (product.price?.mode === "unavailable") return priceCopy[locale].unavailable;
  return null;
}

function statusFromSafeProduct(product: PublicChatSafeProduct): ProductGridItem["status"] | null {
  const state = product.stock?.state as string | undefined;
  if (state !== undefined && state !== "available" && state !== "unavailable" && state !== "unknown") return null;
  if (state === "available") return "in_stock";
  if (state === "unavailable") return "out_of_stock";
  return "unknown";
}

export function adaptChatProduct(
  product: PublicChatSafeProduct,
  locale: PublicChatLocale,
): ProductCardAdaptation {
  const brand = product.attributes?.brand?.trim();
  if (!nonEmpty(brand)) return { ok: false, reason: "missing_brand" };

  if (!product.image || !nonEmpty(product.image.src) || !nonEmpty(product.image.alt)) {
    return { ok: false, reason: "missing_image" };
  }

  if (!relativeCanonicalLink(product.canonicalLink)) {
    return { ok: false, reason: "missing_link" };
  }

  const price = priceFromSafeProduct(product, locale);
  if (price === null) return { ok: false, reason: "invalid_price" };

  const status = statusFromSafeProduct(product);
  if (status === null) return { ok: false, reason: "invalid_stock" };

  return {
    ok: true,
    product: {
      id: product.variantId,
      brand,
      brandLogoUrl: null,
      category: product.attributes?.category,
      name: product.title,
      searchVariantId: product.variantId,
      subtitle: subtitleFromAttributes(product.attributes),
      status,
      imageUrl: product.image.src,
      imageAlt: product.image.alt,
      href: product.canonicalLink,
      oldPrice: null,
      discount: null,
      price,
      swatches: [],
    },
  };
}

export function adaptChatProducts(
  products: readonly PublicChatSafeProduct[],
  locale: PublicChatLocale,
): ProductCardAdaptationSummary {
  const adapted: ProductGridItem[] = [];
  const skipped: ProductCardSkip[] = [];

  for (const product of products) {
    const result = adaptChatProduct(product, locale);
    if (result.ok) {
      adapted.push(result.product);
    } else {
      skipped.push({ variantId: product.variantId, reason: result.reason });
    }
  }

  return { products: adapted, skipped };
}
