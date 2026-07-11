import { parseKoreanBackfillInput, translationKind } from "./contract";
import type { KoreanBackfillInput } from "./contract";
import { requestKoreanTranslationBatch } from "./deepseek";
import type { Fetcher } from "./deepseek";

export class MissingDeepSeekApiKeyError extends Error {
  constructor() {
    super("DEEPSEEK_API_KEY is required to generate drafts");
    this.name = "MissingDeepSeekApiKeyError";
  }
}

type PipelineOptions = Readonly<{
  apiKey?: string;
  batchSize?: number;
  completedIndexes?: ReadonlySet<number>;
  concurrency?: number;
  fetcher: Fetcher;
  mode: "generate" | "validate-only";
  onResolution?: (resolution: KoreanDraftResolution) => Promise<void>;
}>;

export type KoreanDraft = Readonly<{
  id: string;
  table: string;
  column: string;
  sourceLanguage: "vi" | "en";
  source: string | readonly string[];
  translation: string | readonly string[];
}>;

export type KoreanRejection = Readonly<{ index: number; reason: string }>;
export type KoreanDraftResult = Readonly<{ drafts: readonly KoreanDraft[]; rejections: readonly KoreanRejection[] }>;

export type KoreanDraftResolution =
  | Readonly<{ kind: "draft"; index: number; draft: KoreanDraft }>
  | Readonly<{ kind: "rejection"; rejection: KoreanRejection }>;

const defaultConcurrency = 4;
const defaultBatchSize = 25;

function rejectionFor(index: number, error: Error): KoreanRejection {
  return { index, reason: error.message };
}

async function recordResolution(
  resolution: KoreanDraftResolution,
  drafts: KoreanDraft[],
  rejections: KoreanRejection[],
  onResolution: PipelineOptions["onResolution"],
): Promise<void> {
  switch (resolution.kind) {
    case "draft":
      drafts.push(resolution.draft);
      break;
    case "rejection":
      rejections.push(resolution.rejection);
      break;
  }
  await onResolution?.(resolution);
}

type PendingRecord = Readonly<{ index: number; record: unknown }>;
type ValidParsed = Readonly<{ index: number; input: KoreanBackfillInput }>;
type InvalidParsed = Readonly<{ index: number; error: Error }>;

async function resolveBatch(
  batch: readonly PendingRecord[],
  options: PipelineOptions & { apiKey: string },
): Promise<readonly KoreanDraftResolution[]> {
  const valid: ValidParsed[] = [];
  const invalid: InvalidParsed[] = [];

  for (const { index, record } of batch) {
    try {
      valid.push({ index, input: parseKoreanBackfillInput(record) });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("unknown rejection");
      invalid.push({ index, error: failure });
    }
  }

  const resolutions: KoreanDraftResolution[] = invalid.map((entry) => ({
    kind: "rejection",
    rejection: rejectionFor(entry.index, entry.error),
  }));

  if (valid.length === 0) {
    return resolutions;
  }

  try {
    const translations = await requestKoreanTranslationBatch({
      apiKey: options.apiKey,
      fetcher: options.fetcher,
      items: valid.map(({ input }) => ({
        kind: translationKind(input),
        source: input.source.value,
      })),
    });

    if (translations.length !== valid.length) {
      throw new Error("batch translation count mismatch");
    }

    for (const [offset, entry] of valid.entries()) {
      const translation = translations[offset];
      if (translation === undefined) {
        resolutions.push({
          kind: "rejection",
          rejection: rejectionFor(entry.index, new Error("missing batch translation")),
        });
        continue;
      }
      resolutions.push({
        kind: "draft",
        index: entry.index,
        draft: {
          id: entry.input.id,
          table: entry.input.target.table,
          column: entry.input.target.column,
          sourceLanguage: entry.input.source.language,
          source: entry.input.source.value,
          translation,
        },
      });
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("unknown rejection");
    for (const entry of valid) {
      resolutions.push({ kind: "rejection", rejection: rejectionFor(entry.index, failure) });
    }
  }

  return resolutions;
}

export async function produceKoreanDrafts(
  records: readonly unknown[],
  options: PipelineOptions,
): Promise<KoreanDraftResult> {
  const drafts: KoreanDraft[] = [];
  const rejections: KoreanRejection[] = [];

  if (options.mode === "validate-only") {
    for (const [index, record] of records.entries()) {
      try {
        parseKoreanBackfillInput(record);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error("unknown rejection");
        const resolution: KoreanDraftResolution = { kind: "rejection", rejection: rejectionFor(index, failure) };
        await recordResolution(resolution, drafts, rejections, options.onResolution);
      }
    }
    return { drafts, rejections };
  }

  const apiKey = options.apiKey;
  if (apiKey === undefined || apiKey.trim() === "") {
    throw new MissingDeepSeekApiKeyError();
  }
  const resolvedApiKey = apiKey;

  const pending = records.flatMap((record, index) => (options.completedIndexes?.has(index) ? [] : [{ index, record }]));
  const batchSize = Math.max(1, options.batchSize ?? defaultBatchSize);
  const batches: PendingRecord[][] = [];
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    batches.push(pending.slice(offset, offset + batchSize));
  }

  const concurrency = Math.max(1, options.concurrency ?? defaultConcurrency);
  let nextBatchIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const batch = batches[nextBatchIndex];
      nextBatchIndex += 1;
      if (batch === undefined) {
        return;
      }
      const resolutions = await resolveBatch(batch, { ...options, apiKey: resolvedApiKey });
      for (const resolution of resolutions) {
        await recordResolution(resolution, drafts, rejections, options.onResolution);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));

  return { drafts, rejections };
}
