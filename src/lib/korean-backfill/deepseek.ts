import { z } from "zod";

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;
export type TranslationKind = "text" | "array";

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

const textPayloadSchema = z.object({ translation: z.string().trim().min(1) }).strict();
const arrayPayloadSchema = z.object({ translation: z.array(z.string().trim().min(1)).min(1) }).strict();

const batchItemSchema = z.object({
  index: z.number().int().nonnegative(),
  translation: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
}).strict();

const batchPayloadSchema = z.object({
  items: z.array(batchItemSchema).min(1),
}).strict();

export class DeepSeekResponseError extends Error {
  constructor(
    message: string,
    readonly retryableOutput: boolean = false,
  ) {
    super(message);
    this.name = "DeepSeekResponseError";
  }
}

type TranslationRequest = Readonly<{
  apiKey: string;
  fetcher: Fetcher;
  kind: TranslationKind;
  source: string | readonly string[];
}>;

export type BatchTranslationItem = Readonly<{
  kind: TranslationKind;
  source: string | readonly string[];
}>;

type BatchTranslationRequest = Readonly<{
  apiKey: string;
  fetcher: Fetcher;
  items: readonly BatchTranslationItem[];
}>;

const endpoint = "https://api.deepseek.com/chat/completions";
const maximumAttempts = 3;
const timeoutMilliseconds = 60_000;
const hangulPattern = /[\uAC00-\uD7A3]/;
const japanesePattern = /[\u3040-\u30FF\u4E00-\u9FFF]/;

function requestBody(request: TranslationRequest): string {
  return JSON.stringify({
    model: "deepseek-v4-flash",
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Translate supplied Vietnamese or English catalog content into Korean. Every translated text value must contain Hangul. Never use Chinese or Japanese characters. Return only a JSON object with a translation field. Preserve an array when the source is an array.",
      },
      { role: "user", content: JSON.stringify({ source: request.source, expected: request.kind }) },
    ],
  });
}

function batchRequestBody(request: BatchTranslationRequest): string {
  return JSON.stringify({
    model: "deepseek-v4-flash",
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Translate each catalog field into Korean. Every translated text value must contain Hangul. Never use Chinese or Japanese characters. Return only JSON shaped as {\"items\":[{\"index\":0,\"translation\":\"...\"}]}. Use the same index values provided. For array sources, translation must be a non-empty string array. For text sources, translation must be a non-empty string. Do not omit items.",
      },
      {
        role: "user",
        content: JSON.stringify({
          items: request.items.map((item, index) => ({
            index,
            source: item.source,
            expected: item.kind,
          })),
        }),
      },
    ],
  });
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function unfenceJson(content: string): string {
  const fencedJson = /^```json\s*\n([\s\S]*)\n```\s*$/.exec(content);
  return fencedJson?.[1] ?? content;
}

function containsHangul(value: string): boolean {
  return hangulPattern.test(value);
}

function isKoreanTranslation(value: string | readonly string[]): boolean {
  return typeof value === "string"
    ? containsHangul(value) && !japanesePattern.test(value)
    : value.every((item) => containsHangul(item) && !japanesePattern.test(item));
}

function parseTranslation(content: string, kind: TranslationKind): string | readonly string[] {
  let candidate: unknown;
  try {
    candidate = JSON.parse(unfenceJson(content));
  } catch {
    throw new DeepSeekResponseError("invalid DeepSeek response JSON", true);
  }

  const payload = kind === "text" ? textPayloadSchema.safeParse(candidate) : arrayPayloadSchema.safeParse(candidate);
  if (!payload.success) {
    throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
  }

  if (!isKoreanTranslation(payload.data.translation)) {
    throw new DeepSeekResponseError("translation must contain Hangul", true);
  }

  return payload.data.translation;
}

function parseBatchTranslations(
  content: string,
  items: readonly BatchTranslationItem[],
): readonly (string | readonly string[])[] {
  let candidate: unknown;
  try {
    candidate = JSON.parse(unfenceJson(content));
  } catch {
    throw new DeepSeekResponseError("invalid DeepSeek response JSON", true);
  }

  const payload = batchPayloadSchema.safeParse(candidate);
  if (!payload.success) {
    throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
  }

  const byIndex = new Map(payload.data.items.map((item) => [item.index, item.translation]));
  if (byIndex.size !== items.length) {
    throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
  }

  return items.map((item, index) => {
    const translation = byIndex.get(index);
    if (translation === undefined) {
      throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
    }
    if (item.kind === "array") {
      if (!Array.isArray(translation) || translation.length === 0) {
        throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
      }
      if (!isKoreanTranslation(translation)) {
        throw new DeepSeekResponseError("translation must contain Hangul", true);
      }
      return translation;
    }
    if (typeof translation !== "string" || translation.trim() === "") {
      throw new DeepSeekResponseError("invalid DeepSeek response payload", true);
    }
    if (!isKoreanTranslation(translation)) {
      throw new DeepSeekResponseError("translation must contain Hangul", true);
    }
    return translation;
  });
}

async function fetchWithTimeout(
  request: TranslationRequest | BatchTranslationRequest,
  body: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    return await request.fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithRetries<T>(
  request: TranslationRequest | BatchTranslationRequest,
  body: string,
  parse: (content: string) => T,
): Promise<T> {
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let response: Response;

    try {
      response = await fetchWithTimeout(request, body);
    } catch (error) {
      if (attempt === maximumAttempts) {
        throw new DeepSeekResponseError(`DeepSeek request failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }
      continue;
    }

    if (isRetryable(response.status)) {
      if (attempt === maximumAttempts) {
        throw new DeepSeekResponseError(`DeepSeek request failed with status ${response.status}`);
      }
      continue;
    }

    if (!response.ok) {
      throw new DeepSeekResponseError(`DeepSeek request failed with status ${response.status}`);
    }

    const parsedResponse = responseSchema.safeParse(await response.json());
    if (!parsedResponse.success) {
      throw new DeepSeekResponseError("invalid DeepSeek response envelope");
    }

    try {
      return parse(parsedResponse.data.choices[0]?.message.content ?? "");
    } catch (error) {
      if (error instanceof DeepSeekResponseError && error.retryableOutput && attempt < maximumAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw new DeepSeekResponseError("DeepSeek request exhausted retries");
}

export async function requestKoreanTranslation(request: TranslationRequest): Promise<string | readonly string[]> {
  return requestWithRetries(request, requestBody(request), (content) => parseTranslation(content, request.kind));
}

export async function requestKoreanTranslationBatch(
  request: BatchTranslationRequest,
): Promise<readonly (string | readonly string[])[]> {
  if (request.items.length === 0) {
    return [];
  }
  if (request.items.length === 1) {
    const only = request.items[0];
    if (only === undefined) {
      return [];
    }
    const translation = await requestKoreanTranslation({
      apiKey: request.apiKey,
      fetcher: request.fetcher,
      kind: only.kind,
      source: only.source,
    });
    return [translation];
  }

  return requestWithRetries(request, batchRequestBody(request), (content) =>
    parseBatchTranslations(content, request.items),
  );
}
