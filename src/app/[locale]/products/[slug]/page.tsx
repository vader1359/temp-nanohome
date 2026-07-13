import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Section1Hero } from "@/components/product-detail/section-1-hero";
import { Section2Specs } from "@/components/product-detail/section-2-specs";
import { Section3Related } from "@/components/product-detail/section-3-related";
import { Section4Gallery } from "@/components/product-detail/section-4-gallery";
import { Section5Benefits } from "@/components/product-detail/section-5-benefits";
import { Section6Recommended } from "@/components/product-detail/section-6-recommended";
import type { RelatedProduct } from "@/components/product-detail/mock-data";
import { COLORS } from "@/components/product-detail/mock-data";
import { getVariantProducts, type VariantProductListItem } from "@/lib/queries/products";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { getVariantBySlug, getVariantsByProductId } from "@/lib/queries/variants";
import { localizedText } from "@/lib/i18n/content";
import { isUsmContactVariant, isUsmVariant } from "@/lib/products/usm";
import type { Variant } from "@/types/db";
import { isSupportedLocale, type Locale } from "@/i18n/routing";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const dynamic = "force-dynamic";

const priceFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const FALLBACK_PRODUCT_IMAGE = "/images/p_lc2.png";

function formatPrice(variant: Pick<Variant, "sku" | "stock">, price: Variant["price"]): string {
  if (isUsmContactVariant(variant) || price === null || (Number(price) === 0 && !isUsmVariant(variant))) {
    return "Liên hệ";
  }

  return priceFormatter.format(Number(price));
}

function variantText(value: unknown, fallback: string | null = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback ?? "";
}

function getImageUrl(value: unknown): string {
  const text = variantText(value).trim();
  if (text.length === 0) {
    return "";
  }

  if (text.startsWith("/")) {
    return text;
  }

  const attachmentUrl = /\((https?:\/\/[^)\s]+)\)$/u.exec(text)?.[1];
  const candidate = attachmentUrl ?? text;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function getImageUrls(values: readonly unknown[]): string[] {
  return values.map(getImageUrl).filter((url): url is string => url.length > 0);
}

function getGalleryUrls(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasValidDiscount(variant: Pick<Variant, "price" | "compare_at_price" | "discount_percent" | "sku" | "stock">): boolean {
  const price = Number(variant.price);
  const compareAtPrice = Number(variant.compare_at_price);
  return !isUsmContactVariant(variant) && price > 0 && compareAtPrice > price && variant.discount_percent !== null;
}

type VariantRawSource = { readonly raw?: unknown };

function variantRawText(variant: VariantRawSource, key: string): string {
  const raw = variant.raw;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  return variantText((raw as Record<string, unknown>)[key]);
}

function getVariantPackshotUrl(variant: Pick<Variant, "packshot_url"> & { readonly raw?: unknown }): string {
  return (
    getImageUrl(variantRawText(variant, "cldr_packshot_url")) ||
    getImageUrl(variantRawText(variant, "cldr_packshot")) ||
    getImageUrl(variant.packshot_url)
  );
}

function getVariantBrandLogoUrl(variant: Pick<Variant, "brand_cldr_logo"> & { readonly raw?: unknown }): string {
  return getImageUrl(variant.brand_cldr_logo) || getImageUrl(variantRawText(variant, "brand_cldr_logo")) || getImageUrl(variantRawText(variant, "brand_logo"));
}

function getVariantLifestyleImages(
  variant: Pick<Variant, "media_lifestyle_1" | "media_lifestyle_2" | "cldr_media_lifestyle_1" | "cldr_media_lifestyle_2" | "media_long" | "media_closeup" | "gallery_urls">,
): string[] {
  return getImageUrls([
    variantText(variant.media_lifestyle_1),
    variantText(variant.media_lifestyle_2),
    variantText(variant.cldr_media_lifestyle_1),
    variantText(variant.cldr_media_lifestyle_2),
    variantText(variant.media_long),
    variantText(variant.media_closeup),
    ...getGalleryUrls(variant.gallery_urls),
  ]);
}

function getVariantImages(variant: Variant): string[] {
  return getImageUrls([getVariantPackshotUrl(variant), ...getGalleryUrls(variant.gallery_urls)]);
}

type RelatedVariant = Pick<
  Variant,
  | "id"
  | "name"
  | "name_vi"
  | "name_ko"
  | "short_name"
  | "short_name_vi"
  | "short_name_ko"
  | "slug"
  | "slug_vi"
  | "slug_ko"
  | "sku"
  | "stock"
  | "price"
  | "compare_at_price"
  | "discount_percent"
  | "on_sale"
  | "in_stock"
  | "packshot_url"
  | "gallery_urls"
  | "finish"
  | "finish_vi"
  | "finish_ko"
  | "size"
  | "brand_name_denorm"
  | "media_lifestyle_1"
  | "media_lifestyle_2"
  | "cldr_media_lifestyle_1"
  | "cldr_media_lifestyle_2"
  | "media_long"
  | "media_closeup"
>;

function localizedVariantText(variant: Pick<Variant, "name" | "name_vi" | "name_ko">, locale: Locale, fallback: string): string {
  return localizedText({ ko: variant.name_ko, vi: variant.name_vi, en: variant.name }, locale, fallback);
}

function localizedFinish(variant: Pick<Variant, "finish" | "finish_vi" | "finish_ko">, locale: Locale, fallback = ""): string {
  return localizedText({ ko: variant.finish_ko, vi: variant.finish_vi, en: variant.finish }, locale, fallback);
}

function toRelatedProduct(variant: RelatedVariant | VariantProductListItem, locale: Locale): RelatedProduct {
  const discounted = hasValidDiscount(variant);

  return {
    name: localizedVariantText(variant, locale, "Sản phẩm"),
    brand: variantText(variant.brand_name_denorm, "nanoHome"),
    category: [localizedFinish(variant, locale), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    price: formatPrice(variant, discounted ? variant.compare_at_price : variant.price),
    oldPrice: discounted ? formatPrice(variant, variant.compare_at_price) : null,
    discount: discounted ? `-${variant.discount_percent}%` : null,
    image: getVariantPackshotUrl(variant) || getImageUrl(getGalleryUrls(variant.gallery_urls)[0]) || FALLBACK_PRODUCT_IMAGE,
    available: variant.in_stock,
    href: variantDetailHref(variant, locale),
    tags: variant.on_sale && discounted ? ["Sale"] : undefined,
  };
}

function buildHeroProduct(variant: Variant, locale: Locale) {
  const gallery = getVariantImages(variant);
  const title = localizedVariantText(variant, locale, "Sản phẩm");
  const breadcrumbTitle = localizedText({ ko: variant.short_name_ko, vi: variant.short_name_vi, en: variant.short_name }, locale, title);
  const discounted = hasValidDiscount(variant);

  return {
    id: variant.id,
    sku: variantText(variant.sku, variant.id),
    brand: variantText(variant.brand_name_denorm, "nanoHome"),
    brandLogoUrl: getVariantBrandLogoUrl(variant),
    title,
    breadcrumbTitle,
    category: [localizedFinish(variant, locale), variantText(variant.size)].filter(Boolean).join(" / ") || "Sản phẩm",
    onSale: variant.on_sale && discounted,
    oldPrice: discounted ? formatPrice(variant, variant.compare_at_price) : "",
    newPrice: formatPrice(variant, variant.price),
    discount: discounted ? `-${variant.discount_percent}%` : "",
    colors: COLORS,
    gallery: gallery.length > 0 ? gallery : [FALLBACK_PRODUCT_IMAGE],
  };
}

interface ProductSpecLabels {
  readonly availability: string;
  readonly discount: string;
  readonly finish: string;
  readonly inStock: string;
  readonly noDiscount: string;
  readonly outOfStock: string;
  readonly price: string;
  readonly productId: string;
  readonly productName: string;
  readonly size: string;
  readonly sku: string;
  readonly updating: string;
}

function buildSpecColumns(variant: Variant, locale: Locale, labels: ProductSpecLabels) {
  return [
    [
      { label: labels.productName, value: localizedVariantText(variant, locale, labels.productName) },
      { label: labels.sku, value: variantText(variant.sku, labels.updating) },
      { label: labels.availability, value: variant.in_stock ? labels.inStock : labels.outOfStock },
      { label: labels.finish, value: localizedFinish(variant, locale, labels.updating) },
    ],
    [
      { label: labels.size, value: variantText(variant.size, labels.updating) },
      { label: labels.price, value: formatPrice(variant, variant.price) },
      { label: labels.discount, value: hasValidDiscount(variant) ? `${variant.discount_percent}%` : labels.noDiscount },
      { label: labels.productId, value: variant.id },
    ],
  ];
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ProductDetail" });
  const specLabels = {
    availability: t("availability"),
    discount: t("discount"),
    finish: t("finish"),
    inStock: t("inStock"),
    noDiscount: t("noDiscount"),
    outOfStock: t("outOfStock"),
    price: t("price"),
    productId: t("productId"),
    productName: t("productName"),
    size: t("size"),
    sku: t("sku"),
    updating: t("updating"),
  };

  const variant = await getVariantBySlug(decodeURIComponent(slug));
  if (variant === null) {
    notFound();
  }

  const [siblingVariants, similarCategoryVariants, recommendedVariants] = await Promise.all([
    variant.product_id !== null ? getVariantsByProductId(variant.product_id) : Promise.resolve([]),
    getVariantProducts({ categoryId: variant.category_id, excludeId: variant.id, pageSize: 8 }),
    getVariantProducts({ excludeId: variant.id, pageSize: 4 }),
  ]);
  const relatedSource = similarCategoryVariants.length > 0 ? similarCategoryVariants : siblingVariants.filter((item) => item.id !== variant.id);
  const related = relatedSource.slice(0, 8).map((item) => toRelatedProduct(item, locale));
  const recommended = recommendedVariants.map((item) => toRelatedProduct(item, locale));
  const galleryImages = getVariantLifestyleImages(variant);

  return (
    <main className="flex flex-col">
      <Section1Hero product={buildHeroProduct(variant, locale)} />
      <Section2Specs
        specColumns={buildSpecColumns(variant, locale, specLabels)}
        description={localizedText({ ko: variant.meta_description_ko, vi: variant.meta_description_vi, en: variant.meta_description }, locale)}
        designerDescription={localizedText({ ko: variant.designer_description_ko, vi: variant.designer_description_vi, en: variant.designer_description }, locale, t("designerFallback"))}
      />
      <Section3Related products={related} collectionName={localizedFinish(variant, locale, "Cùng dòng")} />
      <Section4Gallery galleryImages={galleryImages.length > 0 ? galleryImages : undefined} />
      <Section5Benefits />
      <Section6Recommended products={recommended} />
    </main>
  );
}
