import "server-only";

import { createHash } from "node:crypto";

import { orchestratePublicChat } from "@/lib/chat/deepseek/orchestrator";
import { resolvePublicChatPolicy, type PublicChatPolicyDecision } from "@/lib/chat/policy";
import { answerEvents, encodePublicChatEvent, publicChatRequestSchema, type PublicChatEvent } from "@/lib/chat/stream-events";
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

type SharedChatWork = {
  promise: Promise<readonly PublicChatEvent[]>;
  readonly controller: AbortController;
  consumers: number;
  settled: boolean;
  expiresAt: number;
};

const sharedWork = new Map<string, SharedChatWork>();
const ttlMs = 30_000;
const maximumCacheEntries = 128;

function responseId(messageRef: string): string {
  return `chat_${createHash("sha256").update(`public-chat:${messageRef}`).digest("hex").slice(0, 32)}`;
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
  return new Response(stream(events), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

function key(input: { readonly messageRef: string; readonly locale: string; readonly question: string }): string {
  return `${input.messageRef}:${input.locale}:${input.question.trim().toLocaleLowerCase()}`;
}

function configEnabled(): boolean {
  return process.env.CHAT_ENABLED === "true" && typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY.length > 0;
}

function releaseConsumer(requestKey: string, work: SharedChatWork): void {
  if (work.consumers <= 0) return;
  work.consumers -= 1;
  if (work.consumers === 0 && !work.settled) work.controller.abort();
  if (work.settled && work.consumers === 0 && work.expiresAt <= Date.now()) sharedWork.delete(requestKey);
}

function addCompletedWork(requestKey: string, work: SharedChatWork, events: readonly PublicChatEvent[]): void {
  work.settled = true;
  work.expiresAt = Date.now() + ttlMs;
  work.promise = Promise.resolve(events);
  setTimeout(() => {
    const current = sharedWork.get(requestKey);
    if (current === undefined || current.promise !== work.promise || current.expiresAt > Date.now()) return;
    sharedWork.delete(requestKey);
  }, ttlMs).unref?.();
  while (sharedWork.size > maximumCacheEntries) {
    const oldestKey = sharedWork.keys().next().value;
    if (oldestKey === undefined) break;
    sharedWork.delete(oldestKey);
  }
}

function awaitForCaller(requestKey: string, work: SharedChatWork, signal: AbortSignal, id: string): Promise<readonly PublicChatEvent[]> {
  if (signal.aborted) {
    releaseConsumer(requestKey, work);
    return Promise.resolve(cancelled(id));
  }
  return new Promise((resolve) => {
    let released = false;
    const cleanupAndRelease = () => {
      if (released) return;
      released = true;
      signal.removeEventListener("abort", onAbort);
      releaseConsumer(requestKey, work);
    };
    const onAbort = () => {
      cleanupAndRelease();
      resolve(cancelled(id));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void work.promise.then((events) => {
      cleanupAndRelease();
      resolve(signal.aborted ? cancelled(id) : events);
    });
  });
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
  if (existing !== undefined && (!existing.settled || existing.expiresAt > Date.now())) {
    existing.consumers += 1;
    return chatResponse(await awaitForCaller(requestKey, existing, request.signal, id));
  }
  if (existing !== undefined) sharedWork.delete(requestKey);
  const controller = new AbortController();
  const workPromise = Promise.resolve().then(async (): Promise<readonly PublicChatEvent[]> => {
    const evidence = retrieveServerEvidence(dependencies, input.question, input.locale);
    const toolNames: PublicChatToolName[] = [];
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
      onToolStarted: (name) => toolNames.push(name),
    });
    if (controller.signal.aborted) return cancelled(id);
    return [{ type: "message_started", responseId: id }, ...toolNames.map((tool) => ({ type: "tool_started" as const, responseId: id, tool })), ...answerEvents(id, answer), { type: "message_completed", responseId: id }];
  }).catch(() => controller.signal.aborted ? cancelled(id) : fallbackEvents(id, fallbackText[input.locale]));
  const work: SharedChatWork = { promise: workPromise, controller, consumers: 1, settled: false, expiresAt: 0 };
  sharedWork.set(requestKey, work);
  void workPromise.then((events) => addCompletedWork(requestKey, work, events));
  return chatResponse(await awaitForCaller(requestKey, work, request.signal, id));
}
