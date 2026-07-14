import { describe, expect, it } from "vitest";

import { getLocalizedMetadata } from "./site-metadata";

describe("site metadata", () => {
  it("uses the social-share hero thumbnail for Open Graph and Twitter", () => {
    const metadata = getLocalizedMetadata("vi");
    const expectedImage = expect.objectContaining({
      url: "/images/home/hero/share-thumbnail.jpg",
      width: 1200,
      height: 630,
    });

    expect(metadata.openGraph?.images).toEqual([expectedImage]);
    expect(metadata.twitter?.images).toEqual([expectedImage]);
  });

  it.each([
    ["vi", "/vi", "vi_VN"],
    ["en", "/en", "en_US"],
    ["ko", "/ko", "ko_KR"],
  ] as const)("builds localized canonical and social metadata for %s", (locale, canonical, openGraphLocale) => {
    const metadata = getLocalizedMetadata(locale);

    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        url: canonical,
        locale: openGraphLocale,
        siteName: "nanoHome",
      }),
    );
    expect(metadata.twitter).toEqual(expect.objectContaining({ card: "summary_large_image" }));
  });
});
