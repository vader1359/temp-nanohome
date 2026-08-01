import { beforeEach, describe, expect, it, vi } from "vitest";

const variants = vi.hoisted(() => ({
  getCachedVariantBySlug: vi.fn(),
}));

vi.mock("@/lib/queries/variants", () => variants);
vi.mock("@/lib/image", () => ({
  firstProductImage: () => "https://media.example/product.png",
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

import { generateMetadata } from "./layout";

describe("product detail metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    variants.getCachedVariantBySlug.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      slug: "series-7-chair",
      slug_vi: "ghe-series-7",
      slug_ko: "series-7-uija",
      name: "Series 7 Chair",
      name_vi: "Ghế Series 7",
      name_ko: "시리즈 7 의자",
      meta_description: "English product description",
      meta_description_vi: "Mô tả sản phẩm tiếng Việt",
      meta_description_ko: "한국어 상품 설명",
      packshot_url: "https://media.example/product.png",
      gallery_urls: [],
    });
  });

  it("uses localized product content, canonical URL, alternates, and share image", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "vi", slug: "ghe-series-7" }),
    });

    expect(variants.getCachedVariantBySlug).toHaveBeenCalledWith("ghe-series-7");
    expect(metadata.title).toBe("Ghế Series 7");
    expect(metadata.description).toBe("Mô tả sản phẩm tiếng Việt");
    expect(metadata.alternates?.canonical).toBe("/vi/products/ghe-series-7");
    expect(metadata.alternates?.languages).toEqual({
      "vi-VN": "/vi/products/ghe-series-7",
      en: "/en/products/series-7-chair",
      "ko-KR": "/ko/products/series-7-uija",
      "x-default": "/vi/products/ghe-series-7",
    });
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://media.example/product.png", alt: "Ghế Series 7" },
    ]);
  });

  it("returns no metadata for an unsupported locale", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "de", slug: "series-7-chair" }),
    });

    expect(metadata).toEqual({});
    expect(variants.getCachedVariantBySlug).not.toHaveBeenCalled();
  });
});
