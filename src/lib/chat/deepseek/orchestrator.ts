import "server-only";

import { z } from "zod";
import { env } from "../../env";
import { publicChatAnswerSchema, publicChatToolCallSchema, type PublicChatAnswer, type PublicChatLocale, type PublicChatToolCall } from "../contracts";
import type { PublicChatPolicyDecision } from "../policy";
import { resolvePublicChatAnswer, type PublicChatServerRegistries, type RenderSafePublicChatAnswer } from "../resolution";
import {
  parseShoppingIntent,
  shoppingIntentToCatalogRequest,
  type ShoppingIntent,
} from "../shopping-intent";
import { executePublicChatTool, type PublicCatalogRecord, type PublicChatToolAdapters, type PublicChatToolResult } from "../tools/public-tools";
import { requestDeepSeek, type DeepSeekModel } from "./provider";

type OrchestratorInput = Readonly<{
  question: string;
  locale: PublicChatLocale;
  apiKey?: string;
  provider?: (input: Parameters<typeof requestDeepSeek>[0]) => Promise<unknown>;
  executeTool?: (input: Parameters<typeof executePublicChatTool>[0], signal?: AbortSignal) => Promise<PublicChatToolResult>;
  evidence?: readonly { readonly sourceId: string; readonly text: string; readonly canonicalUrl?: string }[];
  toolResults?: readonly PublicChatToolResult[];
  registries: PublicChatServerRegistries;
  policyDecision: PublicChatPolicyDecision;
  toolAdapters?: PublicChatToolAdapters;
  signal?: AbortSignal;
  onToolStarted?: (name: PublicChatToolCall["name"]) => void;
  onToolResult?: (result: PublicChatToolResult) => void;
  onIntentParsed?: (intent: ShoppingIntent) => void;
}>;

// A grounded answer can need a catalog search followed by canonical detail lookup.
// Reserve the third bounded round for the model to render that verified result.
const maximumRounds = 3;
const providerResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), answer: publicChatAnswerSchema }).strict(),
  z.object({ kind: z.literal("tool_call"), call: publicChatToolCallSchema }).strict(),
  z.object({ kind: z.literal("unavailable"), reason: z.enum(["provider_error", "aborted"]) }).strict(),
  z.object({ kind: z.literal("invalid_output") }).strict(),
]);

const verifiedCommercialText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Dưới đây là sản phẩm phù hợp từ danh mục đã xác minh. Giá và tình trạng hiện tại chỉ được hiển thị trong thẻ sản phẩm bên dưới.",
  en: "Here is a suitable product from the verified catalog. Current price and availability are shown only in the product card below.",
  ko: "검증된 카탈로그에서 적합한 제품을 찾았습니다. 현재 가격과 재고 여부는 아래 제품 카드에만 표시됩니다.",
};

const catalogResultText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Dưới đây là các sản phẩm phù hợp từ danh mục hiện có. Bạn có thể mở từng sản phẩm để xem chi tiết.",
  en: "Here are suitable products from the current catalog. Open a product to see its details.",
  ko: "현재 카탈로그에서 적합한 제품을 찾았습니다. 각 제품을 열어 자세한 내용을 확인해 보세요.",
};

const comparisonResultText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Dưới đây là thông tin so sánh từ dữ liệu sản phẩm đã được xác minh.",
  en: "Here is a comparison using verified product data.",
  ko: "검증된 제품 데이터를 바탕으로 비교한 내용입니다.",
};

const noCatalogResultText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Hiện tôi chưa tìm thấy sản phẩm công khai đã được duyệt phù hợp với yêu cầu này. Bạn có thể mô tả rõ hơn loại sản phẩm, kích thước, màu sắc hoặc không gian cần sử dụng.",
  en: "I could not find an approved public product matching this request. Try adding the product type, size, color, or intended space.",
  ko: "현재 요청에 맞는 승인된 공개 제품을 찾지 못했습니다. 제품 종류, 크기, 색상 또는 사용할 공간을 더 구체적으로 알려 주세요.",
};

const clarificationText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Để gợi ý đúng hơn, bạn cho tôi biết loại sản phẩm, không gian sử dụng và ngân sách mong muốn nhé.",
  en: "To make a useful recommendation, please tell me the product type, intended space, and budget.",
  ko: "정확한 추천을 위해 제품 종류, 사용할 공간, 예산을 알려 주세요.",
};

const noPageResultText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Hiện tôi chưa tìm thấy thông tin công khai đã được duyệt cho nội dung này. Nhân viên nanoHome có thể hỗ trợ xác nhận thêm.",
  en: "I could not find approved public information for this topic. A nanoHome team member can help confirm it.",
  ko: "현재 이 주제에 대해 승인된 공개 정보를 찾지 못했습니다. nanoHome 담당자가 추가로 확인해 드릴 수 있습니다.",
};

const adapterErrorText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Dữ liệu sản phẩm và website hiện tạm thời không khả dụng. Vui lòng thử lại sau hoặc liên hệ nhân viên nanoHome.",
  en: "Product and website data are temporarily unavailable. Please try again later or contact the nanoHome team.",
  ko: "제품 및 웹사이트 데이터를 일시적으로 불러올 수 없습니다. 잠시 후 다시 시도하거나 nanoHome 담당자에게 문의해 주세요.",
};

const providerErrorText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Dịch vụ tư vấn AI hiện tạm thời không phản hồi. Vui lòng thử lại sau hoặc liên hệ nhân viên nanoHome.",
  en: "The AI advisory service is temporarily unavailable. Please try again later or contact the nanoHome team.",
  ko: "AI 상담 서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도하거나 nanoHome 담당자에게 문의해 주세요.",
};

const invalidRequestText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Yêu cầu này chưa thể được xử lý bằng dữ liệu công khai hiện có. Bạn có thể diễn đạt lại câu hỏi hoặc liên hệ nhân viên nanoHome.",
  en: "This request cannot be processed with the available public data. Try rephrasing it or contact the nanoHome team.",
  ko: "현재 공개 데이터로는 이 요청을 처리할 수 없습니다. 질문을 바꾸어 표현하거나 nanoHome 담당자에게 문의해 주세요.",
};

const capabilityUnavailableText: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Tính năng này chưa khả dụng trong trợ lý công khai. Tôi vẫn có thể hỗ trợ tìm sản phẩm hoặc thông tin website đã được duyệt.",
  en: "This capability is not yet available in the public assistant. I can still help find approved products or website information.",
  ko: "이 기능은 공개 상담 도우미에서 아직 지원되지 않습니다. 승인된 제품 또는 웹사이트 정보 검색은 도와드릴 수 있습니다.",
};

const evidencePrefix: Readonly<Record<PublicChatLocale, string>> = {
  vi: "Theo thông tin công khai đã được phê duyệt:",
  en: "According to the approved public information:",
  ko: "승인된 공개 정보에 따르면:",
};

const evidenceStopWords: Readonly<Record<PublicChatLocale, ReadonlySet<string>>> = {
  vi: new Set([
    "bạn", "các", "cho", "chúng", "có", "của", "đã", "đang", "đây", "để",
    "đó", "được", "hiện", "khi", "là", "mà", "một", "này", "như", "những",
    "sẽ", "tại", "theo", "thì", "tôi", "trên", "trong", "từ", "và", "về", "với",
  ]),
  en: new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "can", "for",
    "from", "has", "have", "here", "in", "is", "it", "its", "of", "on", "or",
    "that", "the", "their", "this", "to", "using", "was", "were", "will", "with",
    "you", "your",
  ]),
  ko: new Set(["그리고", "그러나", "대한", "위한", "있는", "있습니다", "합니다"]),
};

const commercialClaimPattern =
  /(?:\b(?:price|cost|stock|available|availability|sold out|in stock|out of stock)\b|giá|tồn kho|còn hàng|hết hàng|có sẵn|가격|재고|품절|구매 가능|(?:vnd|krw|usd)\b|[₫₩$])/iu;
const publicIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
const informationalQuestionPattern =
  /(?:bảo hành|\bgiao\b|vận chuyển|đổi trả|trả hàng|trả lại|hoàn trả|đổi\s+(?:ghế|sofa|bàn|giường|đèn|thảm|gối|bình\s+hoa|phụ\s+kiện)(?:\s+(?:này|đó))?\s+(?:được|không)|showroom|liên hệ|tư vấn|warranty|delivery|shipping|returns?|refund|exchange|contact|showroom|보증|배송|반품|환불|교환|문의|쇼룸)/iu;
const productQuestionPattern =
  /(?:\b(?:product|products|chair|chairs|sofa|sofas|table|tables|desk|desks|bed|beds|cabinet|cabinets|lamp|lamps|light|lights|vase|vases|furniture|accessories|cushion|cushions|rug|rugs|candle|candles)\b|sản phẩm|nội thất|phụ kiện|ghế|bàn|giường|tủ|đèn|bình hoa|gối|thảm|nến|khăn|trang trí|의자|소파|테이블|책상|침대|수납장|조명|꽃병|제품|가구|액세서리|쿠션|러그)/iu;
const concreteProductPattern =
  /(?:\b(?:chair|chairs|sofa|sofas|table|tables|desk|desks|bed|beds|cabinet|cabinets|lamp|lamps|light|lights|vase|vases|furniture|accessories|cushion|cushions|rug|rugs|candle|candles)\b|nội thất|phụ kiện|ghế|bàn|giường|tủ|đèn|bình hoa|gối|thảm|nến|khăn|trang trí|의자|소파|테이블|책상|침대|수납장|조명|꽃병|가구|액세서리|쿠션|러그)/iu;
const consultationPattern =
  /(?:\b(?:consult|consultation|advise|advice|recommend)\b|tư\s+vấn|gợi\s+ý|상담|추천)/iu;
type PublicPageSection = Extract<
  PublicChatToolCall,
  { readonly name: "get_public_page" }
>["arguments"]["sectionKey"];
const publicPagePatterns: readonly Readonly<{
  sectionKey: PublicPageSection;
  pattern: RegExp;
}>[] = [
  { sectionKey: "returns", pattern: /(?:\b(?:returns?|refunds?|exchanges?)\b|đổi\s+(?:trả|sản\s+phẩm|hàng)|trả\s+(?:hàng|lại)|hoàn\s+(?:tiền|trả)|đổi\s+(?:ghế|sofa|bàn|giường|đèn|thảm|gối|bình\s+hoa|phụ\s+kiện)(?:\s+(?:này|đó))?\s+(?:được|không)|반품|환불|교환)/iu },
  { sectionKey: "delivery", pattern: /(?:\b(?:delivery|shipping)\b|giao\s+hàng|vận\s+chuyển|배송)/iu },
  { sectionKey: "warranty", pattern: /(?:\b(?:warranty|after-sales?)\b|bảo\s+hành|hậu\s+mãi|보증|사후\s*지원)/iu },
  { sectionKey: "consultation", pattern: /(?:\bconsultation\b|tư\s+vấn|상담)/iu },
  { sectionKey: "contact", pattern: /(?:\b(?:contact|showrooms?)\b|liên\s+hệ|showroom|문의|쇼룸)/iu },
];
type ComparisonAttributeKey = Extract<
  PublicChatAnswer["blocks"][number],
  { readonly type: "comparison" }
>["attributeKeys"][number];
const comparisonAttributeKeys = new Set<ComparisonAttributeKey>([
  "dimensions",
  "material",
  "finish",
  "color",
  "brand",
  "category",
  "product",
  "designer",
  "collection",
  "description",
  "designer_description",
]);

function catalogRecords(
  toolResults: readonly PublicChatToolResult[],
): readonly PublicCatalogRecord[] {
  const seen = new Set<string>();
  return toolResults.flatMap((result) => {
    if (result.kind !== "catalog" && result.kind !== "comparison") return [];
    return result.records.flatMap((record) => {
      if (seen.has(record.variantId)) return [];
      seen.add(record.variantId);
      return [record];
    });
  });
}

function hasGroundingData(
  input: OrchestratorInput,
  toolResults: readonly PublicChatToolResult[],
): boolean {
  if ((input.evidence?.length ?? 0) > 0) return true;
  return toolResults.some((result) => {
    if (result.kind === "catalog" || result.kind === "comparison") {
      return result.records.length > 0;
    }
    return result.kind === "page" || result.kind === "handoff";
  });
}

function guardGroundedAnswer(
  answer: PublicChatAnswer,
  input: OrchestratorInput,
  toolResults: readonly PublicChatToolResult[],
): PublicChatAnswer | undefined {
  if (!hasGroundingData(input, toolResults)) return undefined;
  const approvedSourceIds = new Set(
    (input.evidence ?? []).map(({ sourceId }) => sourceId),
  );
  const hasSuccessfulToolResult = toolResults.some((result) =>
    result.kind === "catalog" && result.records.length > 0
    || result.kind === "comparison" && result.records.length > 0
    || result.kind === "page"
    || result.kind === "handoff",
  );
  if (
    approvedSourceIds.size > 0
    && !hasSuccessfulToolResult
    && !answer.evidence.some(({ sourceId }) => approvedSourceIds.has(sourceId))
  ) {
    return undefined;
  }
  if (
    approvedSourceIds.size > 0
    && !hasSuccessfulToolResult
    && !evidenceSupportsAnswerText(answer.text, input)
  ) {
    return undefined;
  }
  const records = catalogRecords(toolResults);
  const verifiedVariantIds = new Set(records.map(({ variantId }) => variantId));
  const groundedBlocks = answer.blocks.flatMap((block): PublicChatAnswer["blocks"] => {
    if (block.type === "product_cards") {
      const variantIds = [...new Set(block.variantIds)].filter((variantId) =>
        verifiedVariantIds.has(variantId)
      );
      return variantIds.length === 0 ? [] : [{ ...block, variantIds }];
    }
    if (block.type === "comparison") {
      const variantIds = [...new Set(block.variantIds)].filter((variantId) =>
        verifiedVariantIds.has(variantId)
      );
      return variantIds.length < 2 ? [] : [{ ...block, variantIds }];
    }
    return [block];
  });
  const hasVisualProductBlock = groundedBlocks.some(
    (block) => block.type === "product_cards" || block.type === "comparison",
  );
  const blocks = hasVisualProductBlock || records.length === 0
    ? groundedBlocks
    : [
        ...groundedBlocks.slice(0, 7),
        {
          type: "product_cards" as const,
          variantIds: records.slice(0, 8).map((record) => record.variantId),
        },
      ];
  if (!commercialClaimPattern.test(answer.text)) return { ...answer, blocks };
  if (records.length === 0) return undefined;
  return { ...answer, text: verifiedCommercialText[input.locale], blocks };
}

function fallback(input: OrchestratorInput): RenderSafePublicChatAnswer {
  return { text: input.policyDecision.text, blocks: [], evidence: [], followUps: [] };
}

function plainAnswer(text: string): RenderSafePublicChatAnswer {
  return { text, blocks: [], evidence: [], followUps: [] };
}

function isComparisonAttributeKey(value: string): value is ComparisonAttributeKey {
  return comparisonAttributeKeys.has(value as ComparisonAttributeKey);
}

function sanitizeEvidenceText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)|<[^>]*>|https?:\/\/[^\s)]+/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizedKnowledgeToken(
  value: string,
  locale: PublicChatLocale,
): string {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  if (locale !== "ko") return normalized;
  return normalized.replace(
    /(?:에서|에게|으로|은|는|이|가|을|를|의|에|로|와|과|도|만|입니다|합니다|됩니다|이다)$/u,
    "",
  );
}

function knowledgeTokens(
  value: string,
  locale: PublicChatLocale,
): readonly string[] {
  const stopWords = evidenceStopWords[locale];
  return [
    ...new Set(
      (value.match(/[\p{L}\p{N}]+/gu) ?? [])
        .map((token) => normalizedKnowledgeToken(token, locale))
        .filter((token) => [...token].length >= 2 && !stopWords.has(token)),
    ),
  ];
}

function evidenceSupportsAnswerText(
  text: string,
  input: OrchestratorInput,
): boolean {
  const evidenceText = (input.evidence ?? []).map(({ text: value }) => value).join(" ");
  if (evidenceText.length === 0) return true;
  const evidenceTokens = new Set(knowledgeTokens(evidenceText, input.locale));
  const evidenceNumbers = new Set(evidenceText.match(/\p{N}+(?:[.,]\p{N}+)*/gu) ?? []);
  const answerNumbers = text.match(/\p{N}+(?:[.,]\p{N}+)*/gu) ?? [];
  if (answerNumbers.some((value) => !evidenceNumbers.has(value))) return false;

  const threshold = input.locale === "ko" ? 0.5 : 0.72;
  return text
    .split(/[.!?。！？]+/u)
    .every((sentence) => {
      const tokens = knowledgeTokens(sentence, input.locale);
      if (tokens.length < 2) return true;
      const supported = tokens.filter((token) => evidenceTokens.has(token)).length;
      return supported / tokens.length >= threshold;
    });
}

function resolvedEvidenceResult(
  input: OrchestratorInput,
): RenderSafePublicChatAnswer | undefined {
  const evidence = (input.evidence ?? []).flatMap(({ sourceId, text }) => {
    if (!publicIdentifierPattern.test(sourceId)) return [];
    const safeText = sanitizeEvidenceText(text);
    return safeText.length === 0 ? [] : [{ sourceId, text: safeText }];
  });
  if (evidence.length === 0) return undefined;
  const selectedEvidence = evidence.slice(0, 1);
  const excerpt = selectedEvidence.map(({ text }) => text).join(" ");
  return resolve({
    text: `${evidencePrefix[input.locale]} ${excerpt}`.slice(0, 1_000),
    blocks: [{ type: "link_list", sourceIds: selectedEvidence.map(({ sourceId }) => sourceId) }],
    evidence: selectedEvidence.map(({ sourceId }) => ({ sourceId })),
    followUps: [],
  }, input, []);
}

function resolvedToolResult(
  input: OrchestratorInput,
  toolResults: readonly PublicChatToolResult[],
): RenderSafePublicChatAnswer | undefined {
  const latest = toolResults.at(-1);
  if (latest?.kind === "catalog" && latest.records.length > 0) {
    return resolve({
      text: catalogResultText[input.locale],
      blocks: [{ type: "product_cards", variantIds: latest.records.slice(0, 8).map((record) => record.variantId) }],
      evidence: [],
      followUps: [],
    }, input, toolResults);
  }
  if (latest?.kind === "comparison" && latest.records.length > 0) {
    return resolve({
      text: comparisonResultText[input.locale],
      blocks: [{
        type: "comparison",
        variantIds: latest.records.slice(0, 4).map((record) => record.variantId),
        attributeKeys: latest.attributeKeys.filter(isComparisonAttributeKey).slice(0, 6),
      }],
      evidence: [],
      followUps: [],
    }, input, toolResults);
  }
  if (latest?.kind === "page") {
    return plainAnswer(
      `${latest.page.title}\n\n${latest.page.body}`.slice(0, 1_000),
    );
  }
  if (latest?.kind === "handoff") {
    return resolve({
      text: input.policyDecision.text,
      blocks: [{ type: "staff_handoff", reasonCode: latest.reasonCode }],
      evidence: [],
      followUps: [],
    }, input, toolResults);
  }
  return undefined;
}

function explicitToolFailure(
  result: PublicChatToolResult,
  locale: PublicChatLocale,
): RenderSafePublicChatAnswer | undefined {
  if (result.kind === "catalog" && result.records.length === 0) {
    return plainAnswer(noCatalogResultText[locale]);
  }
  if (result.kind === "not_found") {
    return plainAnswer(
      result.resource === "catalog"
        ? noCatalogResultText[locale]
        : noPageResultText[locale],
    );
  }
  if (result.kind === "adapter_error") {
    return plainAnswer(adapterErrorText[locale]);
  }
  if (result.kind === "invalid_request") {
    return plainAnswer(invalidRequestText[locale]);
  }
  if (result.kind === "capability_unavailable") {
    return plainAnswer(capabilityUnavailableText[locale]);
  }
  return undefined;
}

function isProductQuestion(question: string): boolean {
  if (!productQuestionPattern.test(question)) return false;
  if (!informationalQuestionPattern.test(question)) return true;
  return consultationPattern.test(question) && concreteProductPattern.test(question);
}

function publicPageIntent(question: string): PublicPageSection | undefined {
  return publicPagePatterns.find(({ pattern }) => pattern.test(question))?.sectionKey;
}

function toolSignature(call: PublicChatToolCall): string {
  return JSON.stringify(call);
}

function deterministicCatalogCall(
  input: OrchestratorInput,
  request: NonNullable<ReturnType<typeof shoppingIntentToCatalogRequest>>,
): PublicChatToolCall {
  if (input.toolAdapters?.catalog.searchStructured !== undefined) {
    return { name: "search_catalog_v2", arguments: request };
  }
  return {
    name: "search_catalog",
    arguments: {
      query: input.question.slice(0, 240),
      limit: request.limit,
    },
  };
}

function isVerifiedFollowupTool(
  call: PublicChatToolCall,
  toolResults: readonly PublicChatToolResult[],
): boolean {
  const records = catalogRecords(toolResults);
  if (call.name === "get_product_details") {
    const canonicalIds = new Set(records.map(({ canonicalId }) => canonicalId));
    return call.arguments.canonicalIds.every((canonicalId) =>
      canonicalIds.has(canonicalId)
    );
  }
  if (call.name === "compare_products") {
    const variantIds = new Set(records.map(({ variantId }) => variantId));
    return call.arguments.variantIds.every((variantId) =>
      variantIds.has(variantId)
    );
  }
  return false;
}

function resolve(
  answer: PublicChatAnswer,
  input: OrchestratorInput,
  toolResults: readonly PublicChatToolResult[],
): RenderSafePublicChatAnswer {
  const catalogRecords = toolResults.flatMap((result) => result.kind === "catalog" || result.kind === "comparison" ? result.records : []);
  const products = catalogRecords.map((record) => ({
    variantId: record.variantId,
    title: record.title,
    canonicalId: record.canonicalId,
    canonicalLink: record.canonicalLink,
    image: record.image.src === undefined
      ? { canonicalImageId: record.image.id, alt: record.image.alt }
      : { canonicalImageId: record.image.id, alt: record.image.alt, src: record.image.src },
    price: record.price,
    stock: record.stock,
    attributes: record.attributes,
  }));
  const registries: PublicChatServerRegistries = {
    products: [...input.registries.products, ...products],
    sources: input.registries.sources,
    images: [...input.registries.images, ...products.flatMap((product) => product.image === undefined ? [] : [product.image])],
  };
  return resolvePublicChatAnswer(answer, registries, input.policyDecision);
}

export async function orchestratePublicChat(input: OrchestratorInput): Promise<RenderSafePublicChatAnswer> {
  const apiKey = input.apiKey ?? env.DEEPSEEK_API_KEY;
  if (apiKey === undefined || input.toolAdapters === undefined && input.executeTool === undefined && input.provider === undefined && input.apiKey === undefined) return fallback(input);
  const provider = input.provider ?? ((providerInput) => requestDeepSeek(providerInput));
  const model: DeepSeekModel = env.DEEPSEEK_MODEL === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash";
  const executeTool = input.executeTool ?? (() => {
    const adapters = input.toolAdapters;
    return adapters === undefined
      ? async () => ({ kind: "invalid_request" as const })
      : (toolInput: Parameters<typeof executePublicChatTool>[0], signal?: AbortSignal) => executePublicChatTool(toolInput, adapters, signal);
  })();
  let toolResults = input.toolResults ?? [];
  const shoppingIntent = parseShoppingIntent(input.question, input.locale);
  input.onIntentParsed?.(shoppingIntent);
  const structuredCatalogRequest = shoppingIntentToCatalogRequest(shoppingIntent);
  if (shoppingIntent.kind === "unsupported") return fallback(input);
  if (
    shoppingIntent.kind === "clarification"
    && shoppingIntent.ambiguity !== undefined
    && (input.evidence?.length ?? 0) === 0
    && publicPageIntent(input.question) === undefined
  ) return plainAnswer(clarificationText[input.locale]);
  const executedTools = new Map<string, PublicChatToolResult>();
  const executeOnce = async (call: PublicChatToolCall): Promise<{
    readonly result: PublicChatToolResult;
    readonly repeated: boolean;
  }> => {
    const signature = toolSignature(call);
    const previousResult = executedTools.get(signature);
    if (previousResult !== undefined) {
      return { result: previousResult, repeated: true };
    }
    input.onToolStarted?.(call.name);
    const result = await executeTool(call, input.signal);
    executedTools.set(signature, result);
    toolResults = [...toolResults, result];
    input.onToolResult?.(result);
    return { result, repeated: false };
  };

  const productQuestion = shoppingIntent.kind !== "policy"
    && (structuredCatalogRequest !== undefined || isProductQuestion(input.question));
  // Normal product discovery gets one provider render round after the
  // deterministic retrieval.  Comparisons may spend one extra round on an
  // allowlisted, already-grounded comparison call; general knowledge keeps
  // the existing bounded three-round ceiling.
  const providerRoundLimit = productQuestion
    ? shoppingIntent.kind === "comparison" ? 2 : 1
    : maximumRounds;
  const pageSection = !productQuestion && (input.evidence?.length ?? 0) === 0
    ? publicPageIntent(input.question)
    : undefined;
  if (pageSection !== undefined) {
    if (input.signal?.aborted) return fallback(input);
    try {
      const retrieval = await executeOnce({
        name: "get_public_page",
        arguments: { sectionKey: pageSection, locale: input.locale },
      });
      if (input.signal?.aborted) return fallback(input);
      const failure = explicitToolFailure(retrieval.result, input.locale);
      if (failure !== undefined) return failure;
    } catch {
      return plainAnswer(adapterErrorText[input.locale]);
    }
  }

  if (productQuestion) {
    if (structuredCatalogRequest === undefined) {
      return plainAnswer(clarificationText[input.locale]);
    }
    if (input.signal?.aborted) return fallback(input);
    try {
      const retrieval = await executeOnce(deterministicCatalogCall(input, structuredCatalogRequest));
      if (input.signal?.aborted) return fallback(input);
      const failure = explicitToolFailure(retrieval.result, input.locale);
      if (failure !== undefined) return failure;
    } catch {
      return plainAnswer(adapterErrorText[input.locale]);
    }
  }

  for (let round = 0; round < providerRoundLimit; round += 1) {
    if (input.signal?.aborted) return fallback(input);
    try {
      const providerResult = await provider({ apiKey, model, question: input.question, locale: input.locale, evidence: input.evidence ?? [], toolResults, signal: input.signal });
      if (input.signal?.aborted) return fallback(input);
      const result = providerResultSchema.safeParse(providerResult);
      if (!result.success) {
        return resolvedToolResult(input, toolResults)
          ?? resolvedEvidenceResult(input)
          ?? plainAnswer(providerErrorText[input.locale]);
      }
      if (result.data.kind === "answer") {
        const guardedAnswer = guardGroundedAnswer(result.data.answer, input, toolResults);
        return guardedAnswer === undefined
          ? resolvedToolResult(input, toolResults)
            ?? resolvedEvidenceResult(input)
            ?? plainAnswer(invalidRequestText[input.locale])
          : resolve(guardedAnswer, input, toolResults);
      }
      if (result.data.kind !== "tool_call") {
        return resolvedToolResult(input, toolResults)
          ?? resolvedEvidenceResult(input)
          ?? plainAnswer(providerErrorText[input.locale]);
      }
      if (input.signal?.aborted) return fallback(input);
      if (
        hasGroundingData(input, toolResults)
        && !isVerifiedFollowupTool(result.data.call, toolResults)
      ) {
        return resolvedToolResult(input, toolResults)
          ?? resolvedEvidenceResult(input)
          ?? plainAnswer(invalidRequestText[input.locale]);
      }
      let execution: Awaited<ReturnType<typeof executeOnce>>;
      try {
        execution = await executeOnce(result.data.call);
      } catch {
        return plainAnswer(adapterErrorText[input.locale]);
      }
      if (input.signal?.aborted) return fallback(input);
      const failure = explicitToolFailure(execution.result, input.locale);
      if (failure !== undefined) return failure;
      if (execution.repeated) {
        return resolvedToolResult(input, toolResults)
          ?? resolvedEvidenceResult(input)
          ?? plainAnswer(invalidRequestText[input.locale]);
      }
    } catch {
      return resolvedToolResult(input, toolResults)
        ?? resolvedEvidenceResult(input)
        ?? plainAnswer(providerErrorText[input.locale]);
    }
  }
  return resolvedToolResult(input, toolResults)
    ?? resolvedEvidenceResult(input)
    ?? plainAnswer(invalidRequestText[input.locale]);
}
