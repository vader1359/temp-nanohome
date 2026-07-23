import "server-only";

import enMessages from "../../../../messages/en.json";
import koMessages from "../../../../messages/ko.json";
import viMessages from "../../../../messages/vi.json";

import { SITE_URL } from "@/lib/site-metadata";

import type { PublicChatLocale } from "../contracts";
import { getApprovedPublicSitePage } from "../site-page-adapter";
import {
  ApprovedSourceStore,
  sha256Text,
  type ApprovedSourceAdapter,
  type ApprovedSourceType,
} from "./index";

type SiteMessages = typeof enMessages;
type SourceDraft = Readonly<{
  sourceType: ApprovedSourceType;
  sourceKey: string;
  locale: PublicChatLocale;
  canonicalPath: string;
  text: string;
}>;

const messages: Readonly<Record<PublicChatLocale, SiteMessages>> = {
  en: enMessages,
  vi: viMessages,
  ko: koMessages,
};

const knowledgeLocales = ["vi", "en", "ko"] as const satisfies readonly PublicChatLocale[];
const PUBLIC_COPY_VERSION = "website-copy-2026-07-23";

const topicLabels: Readonly<
  Record<
    PublicChatLocale,
    Readonly<Record<"delivery" | "warranty" | "consultation" | "contact", string>>
  >
> = {
  vi: {
    delivery: "Giao hàng",
    warranty: "Bảo hành và hậu mãi",
    consultation: "Tư vấn sản phẩm",
    contact: "Liên hệ và showroom",
  },
  en: {
    delivery: "Delivery",
    warranty: "Warranty and after-sales support",
    consultation: "Product consultation",
    contact: "Contact and showrooms",
  },
  ko: {
    delivery: "배송",
    warranty: "보증 및 사후 지원",
    consultation: "제품 상담",
    contact: "문의 및 쇼룸",
  },
};

function plainText(parts: readonly (string | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function approvedCopy(text: string): string {
  return text.replace(/\bMalxato\b/gu, "Maxalto");
}

function canonicalUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

function localizedDrafts(locale: PublicChatLocale): readonly SourceDraft[] {
  const content = messages[locale];
  const aboutPath = `/${locale}/about-us`;
  const productsPath = `/${locale}/products`;
  const siteSections = (["delivery", "warranty", "consultation", "contact"] as const)
    .flatMap((sectionKey): readonly SourceDraft[] => {
      const publicPage = getApprovedPublicSitePage(sectionKey, locale);
      if (publicPage === null) return [];
      return [{
        sourceType: sectionKey === "contact" ? "public_page" : "faq",
        sourceKey: `site-${sectionKey}`,
        locale,
        canonicalPath: sectionKey === "contact" ? aboutPath : productsPath,
        text: plainText([topicLabels[locale][sectionKey], publicPage.title, publicPage.body]),
      }];
    });

  return [
    {
      sourceType: "public_page",
      sourceKey: "about-nanohome",
      locale,
      canonicalPath: aboutPath,
      text: plainText([
        content.About.eyebrow,
        content.About.heading,
        content.About.leftHeading,
        approvedCopy(content.About.p1),
      ]),
    },
    {
      sourceType: "public_page",
      sourceKey: "brands-overview",
      locale,
      canonicalPath: `/${locale}/brands`,
      text: plainText([
        content.Brands.eyebrow,
        content.Brands.title,
        content.Brands.description,
        approvedCopy(content.About.p1),
      ]),
    },
    {
      sourceType: "catalog_entry",
      sourceKey: "product-categories",
      locale,
      canonicalPath: productsPath,
      text: plainText([
        content.Header.products,
        content.Footer.col3Heading,
        content.Footer.col3Link1,
        content.Footer.col3Link2,
        content.Footer.col3Link3,
        content.Footer.col3Link4,
        content.Header.livingRoom,
        content.Header.diningRoom,
        content.Header.bedroom,
        content.Header.workspace,
        content.Header.outdoor,
        content.Header.accessories,
        content.Header.bySet,
      ]),
    },
    ...siteSections,
  ];
}

function approvedSource(draft: SourceDraft): ApprovedSourceAdapter {
  return {
    sourceType: draft.sourceType,
    sourceKey: draft.sourceKey,
    locale: draft.locale,
    version: PUBLIC_COPY_VERSION,
    canonicalUrl: canonicalUrl(draft.canonicalPath),
    text: draft.text,
    contentHash: sha256Text(draft.text),
    approvalState: "approved",
    visibility: "public",
    isActive: true,
  };
}

export function createApprovedPublicKnowledgeStore(): ApprovedSourceStore {
  const store = new ApprovedSourceStore();

  for (const locale of knowledgeLocales) {
    for (const draft of localizedDrafts(locale)) {
      const source = approvedSource(draft);
      const result = store.ingest(source);
      if (!result.accepted) {
        throw new Error(`Invalid approved public source: ${source.sourceKey}:${source.locale}`);
      }
    }
  }

  return store;
}
