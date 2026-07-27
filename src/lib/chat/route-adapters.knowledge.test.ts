import { describe, expect, it } from "vitest";

import {
  createLiveServerChatDependencies,
  retrieveServerEvidence,
} from "./route-adapters";

describe("live approved public knowledge", () => {
  it.each([
    ["vi", "nanoHome là gì?", "/vi/about-us", "nanoHome"],
    ["en", "What is nanoHome?", "/en/about-us", "nanoHome"],
    ["ko", "nanoHome은 어떤 곳인가요?", "/ko/about-us", "nanoHome"],
    ["vi", "nanoHome có những thương hiệu nào?", "/vi/brands", "thương hiệu"],
    ["en", "Which brands does nanoHome carry?", "/en/brands", "brands"],
    ["ko", "nanoHome의 취급 브랜드를 알려주세요", "/ko/brands", "브랜드"],
    ["vi", "Thông tin giao hàng như thế nào?", "/vi/products", "Giao hàng"],
    ["en", "How does delivery work?", "/en/products", "Delivery"],
    ["ko", "배송은 어떻게 진행되나요?", "/ko/products", "배송"],
    ["vi", "nanoHome có hỗ trợ bảo hành không?", "/vi/products", "Bảo hành"],
    ["en", "What warranty support is available?", "/en/products", "Warranty"],
    ["ko", "보증 지원은 어떻게 되나요?", "/ko/products", "보증"],
    ["vi", "Tôi cần tư vấn sản phẩm", "/vi/products", "Tư vấn"],
    ["en", "I need product consultation", "/en/products", "consultation"],
    ["ko", "제품 상담이 필요해요", "/ko/products", "상담"],
    ["vi", "Thông tin liên hệ showroom", "/vi/about-us", "Liên hệ"],
    ["en", "How can I contact a showroom?", "/en/about-us", "Contact"],
    ["ko", "쇼룸 문의 방법을 알려주세요", "/ko/about-us", "문의"],
  ] as const)(
    "retrieves localized public evidence for %s: %s",
    (locale, question, expectedPath, expectedText) => {
      const dependencies = createLiveServerChatDependencies(locale);
      const evidence = retrieveServerEvidence(dependencies, question, locale);

      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: expect.any(String),
            canonicalUrl: `https://www.nanohome.vn${expectedPath}`,
          }),
        ]),
      );
      expect(evidence.map((item) => item.text).join(" ")).toContain(expectedText);
    },
  );

  it.each([
    ["vi", "Chính sách đổi trả và hoàn tiền"],
    ["vi", "Tôi có thể trả hàng không?"],
    ["vi", "Tôi có đổi ghế được không?"],
    ["en", "Returns and refunds"],
    ["en", "Can I exchange this chair?"],
    ["ko", "반품 및 환불"],
    ["ko", "의자 교환이 가능한가요?"],
  ] as const)(
    "does not invent an unpublished returns policy for %s",
    (locale, question) => {
      const dependencies = createLiveServerChatDependencies(locale);

      expect(retrieveServerEvidence(dependencies, question, locale)).toEqual([]);
    },
  );

  it.each([
    ["vi", "Ghế nào phù hợp cho phòng khách?"],
    ["vi", "Tư vấn giúp tôi ghế cho phòng khách"],
    ["en", "Which chair would you recommend for my living room?"],
    ["ko", "거실에 어울리는 의자를 추천해 주세요"],
  ] as const)(
    "does not mix generic site evidence into product discovery for %s",
    (locale, question) => {
      const dependencies = createLiveServerChatDependencies(locale);

      expect(retrieveServerEvidence(dependencies, question, locale)).toEqual([]);
    },
  );

  it.each([
    ["vi", "Giao sản phẩm đến nhà như thế nào?", "/vi/products", "Giao hàng"],
    ["en", "How do you ship products to my home?", "/en/products", "Delivery"],
    ["ko", "제품을 집으로 어떻게 배송하나요?", "/ko/products", "배송"],
  ] as const)(
    "ranks the localized delivery source first for %s",
    (locale, question, expectedPath, expectedText) => {
      const dependencies = createLiveServerChatDependencies(locale);
      const [first] = retrieveServerEvidence(dependencies, question, locale);

      expect(first).toEqual(
        expect.objectContaining({
          canonicalUrl: `https://www.nanohome.vn${expectedPath}`,
          text: expect.stringContaining(expectedText),
        }),
      );
    },
  );
});
