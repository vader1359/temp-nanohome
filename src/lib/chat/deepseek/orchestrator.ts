import "server-only";

import { z } from "zod";
import { env } from "../../env";
import { publicChatAnswerSchema, publicChatToolCallSchema, type PublicChatAnswer, type PublicChatLocale, type PublicChatToolCall } from "../contracts";
import type { PublicChatPolicyDecision } from "../policy";
import { resolvePublicChatAnswer, type PublicChatServerRegistries, type RenderSafePublicChatAnswer } from "../resolution";
import { executePublicChatTool, type PublicChatToolAdapters, type PublicChatToolResult } from "../tools/public-tools";
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

const maximumRounds = 2;
const providerResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), answer: publicChatAnswerSchema }).strict(),
  z.object({ kind: z.literal("tool_call"), call: publicChatToolCallSchema }).strict(),
  z.object({ kind: z.literal("unavailable"), reason: z.enum(["provider_error", "aborted"]) }).strict(),
  z.object({ kind: z.literal("invalid_output") }).strict(),
]);

function fallback(input: OrchestratorInput): RenderSafePublicChatAnswer {
  return { text: input.policyDecision.text, blocks: [], evidence: [], followUps: [] };
}

function resolve(
  answer: PublicChatAnswer,
  input: OrchestratorInput,
  toolResults: readonly PublicChatToolResult[],
): RenderSafePublicChatAnswer {
  const catalogRecords = toolResults.flatMap((result) => result.kind === "catalog" || result.kind === "comparison" ? result.records : []);
  const products = catalogRecords.map((record) => ({ variantId: record.variantId, title: record.title, canonicalId: record.canonicalId, canonicalLink: record.canonicalLink, image: { canonicalImageId: record.image.id, alt: record.image.alt } }));
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
  const model: DeepSeekModel = env.DEEPSEEK_MODEL === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat";
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
      if (result.data.kind === "answer") return resolve(result.data.answer, input, toolResults);
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
