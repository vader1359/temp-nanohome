import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { isSupportedLocale, type Locale } from "@/i18n/routing";
import { firstProductImage } from "@/lib/image";
import { localizedText } from "@/lib/i18n/content";
import { getCachedVariantBySlug } from "@/lib/queries/variants";
import { variantDetailHref } from "@/lib/queries/variant-url";
import { SITE_NAME } from "@/lib/site-metadata";
import type { Variant } from "@/types/db";

interface ProductLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}

function localizedVariantName(variant: Pick<Variant, "name" | "name_vi" | "name_ko">, locale: Locale): string {
  return localizedText({ en: variant.name, vi: variant.name_vi, ko: variant.name_ko }, locale, SITE_NAME);
}

function localizedVariantHref(variant: Pick<Variant, "id" | "slug" | "slug_vi" | "slug_ko">, locale: Locale): string {
  return `/${locale}${variantDetailHref(variant, locale)}`;
}

export async function generateMetadata({ params }: Pick<ProductLayoutProps, "params">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) return {};

  const variant = await getCachedVariantBySlug(decodeURIComponent(slug));
  if (variant === null) return {};

  const title = localizedVariantName(variant, locale);
  const description = localizedText(
    { en: variant.meta_description, vi: variant.meta_description_vi, ko: variant.meta_description_ko },
    locale,
    title,
  );
  const image = firstProductImage([variant.packshot_url, ...variant.gallery_urls]);
  const canonical = localizedVariantHref(variant, locale);
  const languages = {
    "vi-VN": localizedVariantHref(variant, "vi"),
    en: localizedVariantHref(variant, "en"),
    "ko-KR": localizedVariantHref(variant, "ko"),
    "x-default": localizedVariantHref(variant, "vi"),
  };

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: image, alt: title }],
    },
  };
}

export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <div style={{ fontFamily: "var(--font-libre-franklin)" }}>{children}</div>;
}
