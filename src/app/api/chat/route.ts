import "server-only";

import { createHash } from "node:crypto";

import { orchestratePublicChat } from "@/lib/chat/deepseek/orchestrator";
import { resolvePublicChatPolicy, type PublicChatPolicyDecision } from "@/lib/chat/policy";
import { registerPublicChatWorkCacheReset } from "@/lib/chat/public-chat-work-cache";
import { parseShoppingIntent, shoppingIntentFingerprint, type ShoppingIntent } from "@/lib/chat/shopping-intent";
import { buildPublicChatTelemetry, recordPublicChatTelemetry } from "@/lib/chat/observability";
import {
  answerEvents,
  catalogResultEvent,
  encodePublicChatEvent,
  publicChatRequestSchema,
  type PublicChatEvent,
} from "@/lib/chat/stream-events";
import { getServerChatDependencies, retrieveServerEvidence } from "@/lib/chat/route-adapters";
import type { PublicChatToolName } from "@/lib/chat/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fallbackText = {
  vi: "Tôi có thể giúp bạn tìm sản phẩm phù hợp từ thông tin công khai đã được phê duyệt.",
  en: "I can help you find suitable products using approved public information.",
  ko: "승인된 공개 정보를 바탕으로 적합한 제품을 찾도록 도와드릴 수 있습니다.",
} as const;

const maximumRequestBodyBytes = 8 * 1024;
const ttlMs = 30_000;
const maximumCacheEntries = 128;

class RequestBodyError extends Error {
  readonly status: 400 | 413;

  constructor(status: 400 | 413) {
    super(status === 413 ? "request_too_large" : "invalid_request_body");
    this.name = "RequestBodyError";
    this.status = status;
  }
}

function noStore(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBodyBytes) {
    throw new RequestBodyError(413);
  }
  if (request.body === null) throw new RequestBodyError(400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumRequestBodyBytes) {
        await reader.cancel();
        throw new RequestBodyError(413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400);
  } finally {
    reader.releaseLock();
  }
}

type WorkSubscriber = {
  readonly id: string;
  readonly signal: AbortSignal;
  readonly controller: ReadableStreamDefaultController<Uint8Array>;
  readonly onAbort: () => void;
  closed: boolean;
  startedSent: boolean;
};

type SharedChatWork = {
  promise: Promise<void>;
  readonly controller: AbortController;
  readonly intent: ShoppingIntent;
  readonly startedAt: number;
  readonly timing: {
    intentMs: number;
    retrievalMs: number;
    firstBlockMs: number;
    finalMs: number;
  };
  readonly events: PublicChatEvent[];
  readonly subscribers: Set<WorkSubscriber>;
  consumers: number;
  settled: boolean;
  expiresAt: number;
  resultCount: number;
  fallbackCode?: string;
};

const sharedWork = new Map<string, SharedChatWork>();
registerPublicChatWorkCacheReset(() => sharedWork.clear());

function responseId(messageRef: string): string {
  return `chat_${createHash("sha256").update(`public-chat:${messageRef}`).digest("hex").slice(0, 32)}`;
}

function rewriteResponseId(event: PublicChatEvent, id: string): PublicChatEvent {
  return { ...event, responseId: id };
}

function policyFor(question: string, locale: "vi" | "en" | "ko"): PublicChatPolicyDecision | undefined {
  const normalized = question.toLocaleLowerCase();
  const terms = new Set(normalized.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 0));
  const injection = ["ignore", "jailbreak", "system", "developer"].some((term) => terms.has(term)) || normalized.includes("reveal model") || normalized.includes("reveal instruction");
  if (injection) return resolvePublicChatPolicy({ kind: "prompt_injection", locale });
  if (["staff", "customer", "account", "personal", "order"].some((term) => terms.has(term))) return resolvePublicChatPolicy({ kind: terms.has("staff") ? "staff_access" : terms.has("customer") || terms.has("account") || terms.has("personal") ? "customer_access" : "order_access", locale });
  if (["discount", "install", "guarantee"].some((term) => terms.has(term)) || normalized.includes("exact fit")) return resolvePublicChatPolicy({ kind: "commercial_promise", locale });
  if (["upload", "photo"].some((term) => terms.has(term)) && ["analyze", "room"].some((term) => terms.has(term))) return resolvePublicChatPolicy({ kind: "unsupported", locale });
  if (normalized.includes("policy exception") || normalized.includes("make an exception")) return resolvePublicChatPolicy({ kind: "policy_exception", locale });
  return undefined;
}

function cancelled(id: string): readonly PublicChatEvent[] {
  return [{ type: "message_started", responseId: id }, { type: "message_failed", responseId: id, status: "cancelled" }];
}

function fallbackEvents(id: string, text: string): readonly PublicChatEvent[] {
  return [{ type: "message_started", responseId: id }, { type: "text_delta", responseId: id, text }, { type: "message_completed", responseId: id }];
}

function stream(events: readonly PublicChatEvent[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encodePublicChatEvent(event));
      controller.close();
    },
  });
}

function chatResponse(events: readonly PublicChatEvent[]): Response {
  return new Response(stream(events), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function catalogRevision(): string {
  const revision = process.env.CATALOG_REVISION?.trim();
  return revision === undefined || revision.length === 0 ? "unknown" : revision.slice(0, 128);
}

function key(input: { readonly locale: "vi" | "en" | "ko"; readonly question: string }): string {
  const intent = parseShoppingIntent(input.question, input.locale);
  const intentFingerprint = shoppingIntentFingerprint(intent, catalogRevision());
  const questionFingerprint = intent.kind === "clarification"
    ? createHash("sha256").update(input.question.trim().toLocaleLowerCase()).digest("hex")
    : undefined;
  return createHash("sha256")
    .update(JSON.stringify({ intentFingerprint, locale: input.locale, questionFingerprint }))
    .digest("hex");
}

function configEnabled(): boolean {
  return process.env.CHAT_ENABLED === "true" && typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY.length > 0;
}

function blockFingerprint(event: PublicChatEvent): string | undefined {
  if (event.type !== "block_ready") return undefined;
  if (event.block.type === "product_cards") {
    return JSON.stringify({ type: event.block.type, ids: event.block.products.map(({ variantId }) => variantId) });
  }
  if (event.block.type === "comparison") {
    return JSON.stringify({ type: event.block.type, ids: event.block.products.map(({ variantId }) => variantId), attributes: event.block.attributeKeys });
  }
  return undefined;
}

function releaseConsumer(requestKey: string, work: SharedChatWork): void {
  if (work.consumers <= 0) return;
  work.consumers -= 1;
  if (work.consumers === 0 && !work.settled) work.controller.abort();
  if (work.settled && work.consumers === 0 && work.expiresAt <= Date.now()) sharedWork.delete(requestKey);
}

function closeSubscriber(requestKey: string, work: SharedChatWork, subscriber: WorkSubscriber, closeStream: boolean): void {
  if (subscriber.closed) return;
  subscriber.closed = true;
  subscriber.signal.removeEventListener("abort", subscriber.onAbort);
  work.subscribers.delete(subscriber);
  releaseConsumer(requestKey, work);
  if (closeStream) {
    try {
      subscriber.controller.close();
    } catch {
      // The browser may already have cancelled the stream.
    }
  }
}

function enqueueSubscriber(requestKey: string, work: SharedChatWork, subscriber: WorkSubscriber, event: PublicChatEvent): void {
  if (subscriber.closed) return;
  try {
    subscriber.controller.enqueue(encodePublicChatEvent(rewriteResponseId(event, subscriber.id)));
    if (event.type === "message_started") subscriber.startedSent = true;
  } catch {
    closeSubscriber(requestKey, work, subscriber, false);
  }
}

function publishEvent(requestKey: string, work: SharedChatWork, event: PublicChatEvent): void {
  const fingerprint = blockFingerprint(event);
  if (fingerprint !== undefined && work.events.some((existing) => blockFingerprint(existing) === fingerprint)) return;
  work.events.push(event);
  for (const subscriber of [...work.subscribers]) enqueueSubscriber(requestKey, work, subscriber, event);
}

function finishWork(requestKey: string, work: SharedChatWork): void {
  if (work.timing.finalMs === 0) work.timing.finalMs = performance.now() - work.startedAt;
  recordPublicChatTelemetry(buildPublicChatTelemetry({
    intent: work.intent,
    catalogRevision: catalogRevision(),
    resultCount: work.resultCount,
    timing: work.timing,
    ...(work.controller.signal.aborted
      ? { fallbackCode: "cancelled" }
      : work.fallbackCode === undefined ? {} : { fallbackCode: work.fallbackCode }),
  }));
  work.settled = true;
  if (work.controller.signal.aborted) {
    work.expiresAt = 0;
    if (sharedWork.get(requestKey) === work) sharedWork.delete(requestKey);
  } else {
    work.expiresAt = Date.now() + ttlMs;
  }
  for (const subscriber of [...work.subscribers]) closeSubscriber(requestKey, work, subscriber, true);
  if (work.controller.signal.aborted) return;
  setTimeout(() => {
    const current = sharedWork.get(requestKey);
    if (current !== work || work.expiresAt > Date.now()) return;
    sharedWork.delete(requestKey);
  }, ttlMs).unref?.();
  while (sharedWork.size > maximumCacheEntries) {
    const oldestKey = sharedWork.keys().next().value;
    if (oldestKey === undefined) break;
    sharedWork.delete(oldestKey);
  }
}

function workResponse(requestKey: string, work: SharedChatWork, signal: AbortSignal, id: string): Response {
  let subscriber: WorkSubscriber | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (signal.aborted || work.controller.signal.aborted) {
        for (const event of cancelled(id)) controller.enqueue(encodePublicChatEvent(event));
        controller.close();
        return;
      }
      const next: WorkSubscriber = {
        id,
        signal,
        controller,
        onAbort: () => {
          if (!next.startedSent) enqueueSubscriber(requestKey, work, next, { type: "message_started", responseId: id });
          enqueueSubscriber(requestKey, work, next, { type: "message_failed", responseId: id, status: "cancelled" });
          closeSubscriber(requestKey, work, next, true);
        },
        closed: false,
        startedSent: false,
      };
      subscriber = next;
      work.consumers += 1;
      work.subscribers.add(next);
      signal.addEventListener("abort", next.onAbort, { once: true });
      for (const event of work.events) enqueueSubscriber(requestKey, work, next, event);
      if (work.settled) closeSubscriber(requestKey, work, next, true);
    },
    cancel() {
      if (subscriber !== undefined) closeSubscriber(requestKey, work, subscriber, false);
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function startWork(
  requestKey: string,
  input: { readonly question: string; readonly locale: "vi" | "en" | "ko" },
  dependencies: ReturnType<typeof getServerChatDependencies>,
  id: string,
): SharedChatWork {
  const controller = new AbortController();
  const intentStart = performance.now();
  const intent = parseShoppingIntent(input.question, input.locale);
  const work: SharedChatWork = {
    promise: Promise.resolve(),
    controller,
    intent,
    startedAt: performance.now(),
    timing: {
      intentMs: performance.now() - intentStart,
      retrievalMs: 0,
      firstBlockMs: 0,
      finalMs: 0,
    },
    events: [],
    subscribers: new Set(),
    consumers: 0,
    settled: false,
    expiresAt: 0,
    resultCount: 0,
  };
  work.promise = (async () => {
    publishEvent(requestKey, work, { type: "message_started", responseId: id });
    const evidence = retrieveServerEvidence(dependencies, input.question, input.locale);
    const answer = await orchestratePublicChat({
      question: input.question,
      locale: input.locale,
      apiKey: process.env.DEEPSEEK_API_KEY,
      registries: {
        ...dependencies.registries,
        sources: evidence.map((item) => ({ sourceId: item.sourceId, label: item.text.slice(0, 160) })),
      },
      evidence,
      toolAdapters: dependencies.tools,
      policyDecision: resolvePublicChatPolicy({ kind: "unsupported", locale: input.locale }),
      signal: controller.signal,
      onToolStarted: (name: PublicChatToolName) => publishEvent(requestKey, work, { type: "tool_started", responseId: id, tool: name }),
      onToolResult: (result) => {
        if (work.timing.retrievalMs === 0) work.timing.retrievalMs = performance.now() - work.startedAt;
        if (result.kind === "catalog" || result.kind === "comparison") work.resultCount = Math.max(work.resultCount, result.records.length);
        const earlyBlock = catalogResultEvent(id, result);
        if (earlyBlock !== undefined) {
          if (work.timing.firstBlockMs === 0) work.timing.firstBlockMs = performance.now() - work.startedAt;
          publishEvent(requestKey, work, earlyBlock);
        }
      },
    });
    if (controller.signal.aborted) return;
    for (const event of answerEvents(id, answer)) publishEvent(requestKey, work, event);
    work.timing.finalMs = performance.now() - work.startedAt;
    publishEvent(requestKey, work, { type: "message_completed", responseId: id });
  })().catch(() => {
    if (controller.signal.aborted) return;
    work.fallbackCode = "server_error";
    work.timing.finalMs = performance.now() - work.startedAt;
    publishEvent(requestKey, work, { type: "text_delta", responseId: id, text: fallbackText[input.locale] });
    publishEvent(requestKey, work, { type: "message_completed", responseId: id });
  });
  void work.promise.then(() => finishWork(requestKey, work));
  return work;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return noStore(403);
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return noStore(error instanceof RequestBodyError ? error.status : 400);
  }
  const parsed = publicChatRequestSchema.safeParse(body);
  if (!parsed.success) return noStore(400);
  const input = parsed.data;
  const id = responseId(input.messageRef);
  if (request.signal.aborted) return chatResponse(cancelled(id));

  const dependencies = getServerChatDependencies(input.locale);
  if (dependencies.rateLimit !== undefined) {
    try {
      if (!await dependencies.rateLimit(request)) return noStore(429);
    } catch {
      return noStore(503);
    }
  }

  const policy = policyFor(input.question, input.locale);
  if (policy !== undefined) return chatResponse(fallbackEvents(id, policy.text));
  if (!configEnabled()) return chatResponse(fallbackEvents(id, fallbackText[input.locale]));
  if (dependencies.grounding.kind === "unavailable") return chatResponse(fallbackEvents(id, fallbackText[input.locale]));

  const requestKey = key(input);
  const existing = sharedWork.get(requestKey);
  if (existing !== undefined && !existing.controller.signal.aborted && (!existing.settled || existing.expiresAt > Date.now())) {
    return workResponse(requestKey, existing, request.signal, id);
  }
  if (existing !== undefined) sharedWork.delete(requestKey);

  const work = startWork(requestKey, input, dependencies, id);
  sharedWork.set(requestKey, work);
  if (request.signal.aborted) {
    work.controller.abort();
    return chatResponse(cancelled(id));
  }
  return workResponse(requestKey, work, request.signal, id);
}
