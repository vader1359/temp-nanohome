import "server-only";

import enMessages from "../../../messages/en.json";
import koMessages from "../../../messages/ko.json";
import viMessages from "../../../messages/vi.json";

import type { PublicChatLocale } from "./contracts";
import type { PublicSitePage } from "./tools/public-tools";

type PublicSiteSection = "delivery" | "warranty" | "consultation" | "contact" | "returns";
type SiteMessages = typeof enMessages;

const messages: Readonly<Record<PublicChatLocale, SiteMessages>> = {
  en: enMessages,
  vi: viMessages,
  ko: koMessages,
};

function page(
  sectionKey: PublicSiteSection,
  locale: PublicChatLocale,
  title: string,
  body: string,
): PublicSitePage {
  return { sectionKey, locale, title, body };
}

export function getApprovedPublicSitePage(
  sectionKey: string,
  locale: PublicChatLocale,
): PublicSitePage | null {
  const content = messages[locale];
  switch (sectionKey) {
    case "delivery":
      return page(
        sectionKey,
        locale,
        content.ProductDetail.benefitDeliveryTitle,
        content.ProductDetail.benefitDeliveryDescription,
      );
    case "warranty":
      return page(
        sectionKey,
        locale,
        content.ProductDetail.benefitWarrantyTitle,
        content.ProductDetail.benefitWarrantyDescription,
      );
    case "consultation":
      return page(
        sectionKey,
        locale,
        content.ProductDetail.benefitSupportTitle,
        content.ProductDetail.benefitSupportDescription,
      );
    case "contact":
      return page(
        sectionKey,
        locale,
        content.Footer.col6Heading,
        [
          content.Footer.phone,
          content.Footer.email,
          content.Footer.showroom1,
          content.Footer.showroom1Address,
          content.Footer.showroom1Hours,
          content.Footer.showroom2,
          content.Footer.showroom2Address,
          content.Footer.showroom2Hours,
        ].filter((value) => value.length > 0).join(" · "),
      );
    case "returns":
      // The public footer still marks the sales policy as coming soon.
      return null;
    default:
      return null;
  }
}
