import "server-only";

import { z } from "zod";
import { env } from "../../env";
import { publicChatAnswerSchema, publicChatToolCallSchema, type PublicChatAnswer, type PublicChatLocale, type PublicChatToolCall } from "../contracts";
import type { PublicChatPolicyDecision } from "../policy";
import { resolvePublicChatAnswer, type PublicChatServerRegistries, type RenderSafePublicChatAnswer } from "../resolution";
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
  vi: "Giá và tình trạng hiện tại chỉ được hiển thị từ dữ liệu sản phẩm đã xác minh trong các thẻ bên dưới.",
  en: "Current price and availability are shown only from verified product data in the cards below.",
  ko: "현재 가격과 재고 여부는 아래 카드의 검증된 제품 데이터로만 표시됩니다.",
};

const commercialClaimPattern =
  /(?:\b(?:price|cost|stock|available|availability|sold out|in stock|out of stock)\b|giá|tồn kho|còn hàng|hết hàng|có sẵn|가격|재고|품절|구매 가능|(?:vnd|krw|usd)\b|[₫₩$])/iu;

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
  const records = catalogRecords(toolResults);
  const hasVisualProductBlock = answer.blocks.some(
    (block) => block.type === "product_cards" || block.type === "comparison",
  );
  const blocks = hasVisualProductBlock || records.length === 0
    ? answer.blocks
    : [
        ...answer.blocks.slice(0, 7),
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
  for (let round = 0; round < maximumRounds; round += 1) {
    if (input.signal?.aborted) return fallback(input);
    try {
      const providerResult = await provider({ apiKey, model, question: input.question, locale: input.locale, evidence: input.evidence ?? [], toolResults, signal: input.signal });
      if (input.signal?.aborted) return fallback(input);
      const result = providerResultSchema.safeParse(providerResult);
      if (!result.success) return fallback(input);
      if (result.data.kind === "answer") {
        const guardedAnswer = guardGroundedAnswer(result.data.answer, input, toolResults);
        return guardedAnswer === undefined
          ? fallback(input)
          : resolve(guardedAnswer, input, toolResults);
      }
      if (result.data.kind !== "tool_call") return fallback(input);
      if (input.signal?.aborted) return fallback(input);
      input.onToolStarted?.(result.data.call.name);
      toolResults = [...toolResults, await executeTool(result.data.call, input.signal)];
      if (input.signal?.aborted) return fallback(input);
    } catch {
      return fallback(input);
    }
  }
  return fallback(input);
}
