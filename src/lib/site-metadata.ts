import type { Metadata } from "next";

import type { Locale } from "@/i18n/routing";

export const SITE_NAME = "nanoHome";
export const SITE_URL = "https://www.nanohome.vn";

const SHARE_IMAGE = {
  url: "/images/home/hero/share-thumbnail.jpg",
  width: 1200,
  height: 630,
  alt: "Không gian nội thất thiết kế tại nanoHome",
};

const localeMetadata: Record<
  Locale,
  {
    title: string;
    description: string;
    openGraphLocale: string;
  }
> = {
  vi: {
    title: "Nội thất thiết kế chính hãng",
    description:
      "Khám phá nội thất thiết kế chính hãng từ Cassina, B&B Italia, Maxalto và các thương hiệu hàng đầu tại nanoHome.",
    openGraphLocale: "vi_VN",
  },
  en: {
    title: "Authentic Designer Furniture",
    description:
      "Discover authentic designer furniture from Cassina, B&B Italia, Maxalto, and leading global brands at nanoHome.",
    openGraphLocale: "en_US",
  },
  ko: {
    title: "정품 디자이너 가구",
    description:
      "nanoHome에서 Cassina, B&B Italia, Maxalto 등 세계적인 브랜드의 정품 디자이너 가구를 만나보세요.",
    openGraphLocale: "ko_KR",
  },
};

const languageAlternates = {
  "vi-VN": "/vi",
  en: "/en",
  "ko-KR": "/ko",
  "x-default": "/vi",
};

export function getLocalizedMetadata(locale: Locale): Metadata {
  const content = localeMetadata[locale];
  const title = `${content.title} | ${SITE_NAME}`;

  return {
    title: content.title,
    description: content.description,
    alternates: {
      canonical: `/${locale}`,
      languages: languageAlternates,
    },
    openGraph: {
      type: "website",
      url: `/${locale}`,
      siteName: SITE_NAME,
      title,
      description: content.description,
      locale: content.openGraphLocale,
      alternateLocale: Object.values(localeMetadata)
        .map(({ openGraphLocale }) => openGraphLocale)
        .filter((openGraphLocale) => openGraphLocale !== content.openGraphLocale),
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: content.description,
      images: [SHARE_IMAGE],
    },
  };
}
