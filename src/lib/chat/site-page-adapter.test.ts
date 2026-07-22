import { describe, expect, it } from "vitest";

import { getApprovedPublicSitePage } from "./site-page-adapter";

describe("approved public site page adapter", () => {
  it.each([
    ["vi", "Giao hàng nhanh, an tâm", "Đảm bảo chất lượng", "Tư vấn chuyên môn"],
    ["en", "Fast, secure delivery", "Quality assurance", "Expert support"],
    ["ko", "빠르고 안전한 배송", "품질 보증", "전문 상담"],
  ] as const)(
    "serves only existing localized %s website copy",
    (locale, deliveryTitle, warrantyTitle, consultationTitle) => {
      expect(getApprovedPublicSitePage("delivery", locale)).toEqual(
        expect.objectContaining({ locale, title: deliveryTitle }),
      );
      expect(getApprovedPublicSitePage("warranty", locale)).toEqual(
        expect.objectContaining({ locale, title: warrantyTitle }),
      );
      expect(getApprovedPublicSitePage("consultation", locale)).toEqual(
        expect.objectContaining({ locale, title: consultationTitle }),
      );
    },
  );

  it.each(["vi", "en", "ko"] as const)(
    "uses the public footer as the %s contact source without external URLs",
    (locale) => {
      const contact = getApprovedPublicSitePage("contact", locale);

      expect(contact).toEqual(
        expect.objectContaining({
          sectionKey: "contact",
          locale,
          body: expect.stringContaining("info@nanohome.vn"),
        }),
      );
      expect(contact?.body).not.toMatch(/https?:\/\/|<[^>]*>/iu);
      expect(contact?.body.toLocaleLowerCase()).not.toContain("coming soon");
    },
  );

  it.each(["vi", "en", "ko"] as const)(
    "fails closed for returns until an approved public sales policy exists in %s",
    (locale) => {
      expect(getApprovedPublicSitePage("returns", locale)).toBeNull();
    },
  );

  it("fails closed for unknown section keys", () => {
    expect(getApprovedPublicSitePage("internal-policy", "en")).toBeNull();
  });
});
