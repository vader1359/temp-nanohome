import "server-only";

import { createPublicCatalogAdapters } from "./catalog-adapter";
import type { PublicChatLocale } from "./contracts";
import { ApprovedSourceStore, type RetrievalLocale } from "./retrieval";
import { createApprovedPublicKnowledgeStore } from "./retrieval/public-site-loader";
import type { PublicChatServerRegistries } from "./resolution";
import { getApprovedPublicSitePage } from "./site-page-adapter";
import type { PublicChatToolAdapters } from "./tools/public-tools";

export type ServerChatDependencies = Readonly<{
  readonly grounding: { readonly kind: "unavailable"; readonly reason: "catalog_adapter_not_configured" } | { readonly kind: "available" };
  readonly registries: PublicChatServerRegistries;
  readonly retrieval: ApprovedSourceStore;
  readonly rateLimit?: (request: Request) => Promise<boolean>;
  readonly tools: PublicChatToolAdapters;
}>;

export type ServerChatDependenciesProvider = (locale: PublicChatLocale) => ServerChatDependencies;

const unavailableTools: PublicChatToolAdapters = {
  catalog: {
    search: async () => [],
    details: async () => [],
    compare: async () => [],
  },
  site: { page: async () => null },
  handoff: { create: async ({ reasonCode }) => ({ id: "handoff-unavailable", reasonCode }) },
};

export function createServerChatDependencies(): ServerChatDependencies {
  return {
    grounding: { kind: "unavailable", reason: "catalog_adapter_not_configured" },
    registries: { products: [], sources: [], images: [] },
    retrieval: new ApprovedSourceStore(),
    tools: unavailableTools,
  };
}

export function createLiveServerChatDependencies(locale: PublicChatLocale): ServerChatDependencies {
  return {
    grounding: { kind: "available" },
    registries: { products: [], sources: [], images: [] },
    retrieval: createApprovedPublicKnowledgeStore(),
    tools: {
      catalog: createPublicCatalogAdapters(locale),
      site: { page: async (sectionKey, requestedLocale) => getApprovedPublicSitePage(sectionKey, requestedLocale) },
      handoff: {
        create: async () => {
          throw new Error("Staff handoff is not configured");
        },
      },
    },
  };
}

let serverChatDependenciesProvider: ServerChatDependenciesProvider =
  createLiveServerChatDependencies;

export function getServerChatDependencies(locale: PublicChatLocale = "vi"): ServerChatDependencies {
  return serverChatDependenciesProvider(locale);
}

export function setServerChatDependenciesProvider(provider: ServerChatDependenciesProvider): () => void {
  const previous = serverChatDependenciesProvider;
  serverChatDependenciesProvider = provider;
  return () => {
    serverChatDependenciesProvider = previous;
  };
}

function asksAboutUnpublishedReturns(question: string): boolean {
  return /\b(?:returns?|refunds?|exchanges?)\b/iu.test(question)
    || /đổi\s+(?:trả|sản\s+phẩm|hàng)|trả\s+(?:hàng|lại)|hoàn\s+(?:tiền|trả)/iu.test(question)
    || /đổi\s+(?:ghế|sofa|bàn|giường|đèn|thảm|gối|bình\s+hoa|phụ\s+kiện)(?:\s+(?:này|đó))?\s+(?:được|không)/iu.test(question)
    || /반품|환불|교환/u.test(question);
}

type PublicKnowledgeIntent =
  | "about"
  | "brands"
  | "delivery"
  | "warranty"
  | "contact"
  | "consultation";

const intentQueries: Readonly<
  Record<RetrievalLocale, Readonly<Record<PublicKnowledgeIntent, string>>>
> = {
  vi: {
    about: "Chào mừng nanoHome sống đẹp mỗi ngày",
    brands: "Nhà phân phối chính hãng thương hiệu hiện tại Cassina",
    delivery: "Giao hàng",
    warranty: "Bảo hành hậu mãi",
    contact: "Liên hệ showroom",
    consultation: "Tư vấn chuyên môn Nhận tư vấn phù hợp không gian lựa chọn",
  },
  en: {
    about: "Welcome nanoHome living beautifully every day",
    brands: "Official Authorized Distributor current brands Cassina",
    delivery: "Delivery",
    warranty: "Warranty after-sales support",
    contact: "Contact showrooms",
    consultation: "Expert support tailored advice space product choices",
  },
  ko: {
    about: "nanoHome 오신 것을 환영합니다 매일 아름답게 살기",
    brands: "공식 공인 유통사 현재 취급 브랜드 Cassina",
    delivery: "배송",
    warranty: "보증 사후 지원",
    contact: "문의 쇼룸",
    consultation: "전문 상담 공간 제품 맞는 상담",
  },
};

function publicKnowledgeIntent(question: string): PublicKnowledgeIntent | undefined {
  if (/\b(?:delivery|shipping|ship)\b/iu.test(question) || /\bgiao\b|giao\s+hàng|vận\s+chuyển/iu.test(question) || /배송|배달/u.test(question)) {
    return "delivery";
  }
  if (/\b(?:warrant(?:y|ies)|after[-\s]?sales)\b/iu.test(question) || /bảo\s+hành|hậu\s+mãi/iu.test(question) || /보증|사후\s*(?:지원|서비스)|A\/S/iu.test(question)) {
    return "warranty";
  }
  if (/\b(?:contact|showrooms?|stores?|address|hotline)\b/iu.test(question) || /liên\s+hệ|showroom|cửa\s+hàng|địa\s+chỉ|hotline/iu.test(question) || /문의|쇼룸|매장|연락|주소/u.test(question)) {
    return "contact";
  }
  if (/\b(?:consultation|consult|advis(?:e|or|ory))\b/iu.test(question) || /tư\s+vấn|chuyên\s+gia/iu.test(question) || /상담/u.test(question)) {
    return "consultation";
  }
  if (/\b(?:brands?|manufacturer|distribut(?:e|es|or|ors))\b/iu.test(question) || /thương\s+hiệu|nhãn\s+hiệu|hãng|nhà\s+phân\s+phối/iu.test(question) || /브랜드|유통사|취급/u.test(question)) {
    return "brands";
  }
  if (
    /(?:nanoHome|나노홈).*(?:là\s+gì|giới\s+thiệu|về\s+nanoHome|what\s+is|about|who\s+is|어떤\s+곳|소개)/iu.test(question)
    || /(?:là\s+gì|giới\s+thiệu|what\s+is|tell\s+me\s+about|어떤\s+곳|소개).*(?:nanoHome|나노홈)/iu.test(question)
  ) {
    return "about";
  }
  return undefined;
}

function asksForProductDiscovery(question: string): boolean {
  return /\b(?:chairs?|sofas?|tables?|beds?|lamps?|lights?|rugs?|cushions?|vases?|accessor(?:y|ies)|products?)\b/iu.test(question)
    || /ghế|sofa|bàn|giường|đèn|thảm|gối|bình\s+hoa|phụ\s+kiện|sản\s+phẩm/iu.test(question)
    || /의자|소파|테이블|침대|조명|러그|쿠션|화병|액세서리|제품/u.test(question)
    || /\b(?:recommend|suggest|find|similar|suitable|fit)\b/iu.test(question)
    || /gợi\s+ý|đề\s+xuất|tìm|phù\s+hợp|nên\s+chọn|gần\s+giống/iu.test(question)
    || /추천|제안|찾|어울|적합|비슷/u.test(question);
}

function asksForConcreteProduct(question: string): boolean {
  return /\b(?:chairs?|sofas?|tables?|beds?|lamps?|lights?|rugs?|cushions?|vases?|accessor(?:y|ies))\b/iu.test(question)
    || /ghế|sofa|bàn|giường|đèn|thảm|gối|bình\s+hoa|phụ\s+kiện/iu.test(question)
    || /의자|소파|테이블|침대|조명|러그|쿠션|화병|액세서리/u.test(question);
}

function expandKoreanQuery(question: string): string {
  const tokens = question.match(/[\p{L}\p{N}]+/gu) ?? [];
  const stems = tokens.flatMap((token) => {
    const stem = token.replace(/(?:에서|에게|으로|은|는|이|가|을|를|의|에|로|와|과|도|만)$/u, "");
    return stem.length > 0 && stem !== token ? [stem] : [];
  });
  return stems.length === 0 ? question : `${question} ${stems.join(" ")}`;
}

function retrievalQuery(
  question: string,
  locale: RetrievalLocale,
  intent: PublicKnowledgeIntent | undefined,
): string {
  if (intent !== undefined) return intentQueries[locale][intent];
  return locale === "ko" ? expandKoreanQuery(question) : question;
}

export function retrieveServerEvidence(
  dependencies: ServerChatDependencies,
  question: string,
  locale: RetrievalLocale,
): readonly { readonly sourceId: string; readonly text: string; readonly canonicalUrl?: string }[] {
  // The storefront still marks its sales/returns policy as unpublished.
  // Do not let shared words retrieve unrelated content as a substitute policy.
  if (asksAboutUnpublishedReturns(question)) return [];
  const intent = publicKnowledgeIntent(question);
  // Product discovery belongs to the catalog adapter. Public-site copy is too
  // broad to ground a concrete product recommendation safely.
  if (
    asksForConcreteProduct(question)
    || intent === undefined && asksForProductDiscovery(question)
  ) return [];
  return dependencies.retrieval.retrieve({
    query: retrievalQuery(question, locale, intent),
    locale,
    maxResults: intent === undefined ? 8 : 1,
    maxTextChars: intent === undefined ? 2_000 : 1_000,
  });
}
