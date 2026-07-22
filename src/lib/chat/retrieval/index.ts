import { createHash } from "node:crypto";
import { z } from "zod";

export const retrievalLocales = ["vi", "en", "ko"] as const;
export type RetrievalLocale = (typeof retrievalLocales)[number];
export const approvedSourceTypes = ["public_page", "policy", "faq", "catalog_entry"] as const;
export type ApprovedSourceType = (typeof approvedSourceTypes)[number];
export type ApprovalState = "approved" | "pending" | "rejected";
export type Visibility = "public" | "internal";

export type ApprovedSourceAdapter = {
  readonly sourceType: ApprovedSourceType;
  readonly sourceKey: string;
  readonly locale: RetrievalLocale;
  readonly version: string;
  readonly canonicalUrl: string;
  readonly text: string;
  readonly contentHash: string;
  readonly approvalState: ApprovalState;
  readonly visibility: Visibility;
  readonly isActive: boolean;
};

export type RetrievedEvidence = {
  readonly sourceId: string;
  readonly canonicalUrl: string;
  readonly locale: RetrievalLocale;
  readonly text: string;
  readonly score: number;
  readonly position: number;
  readonly isInstruction: false;
};

export type RetrievalOptions = {
  readonly query: string;
  readonly locale: RetrievalLocale;
  readonly maxResults?: number;
  readonly maxTextChars?: number;
};

type StoredChunk = {
  readonly text: string;
  readonly position: number;
  readonly sourceHash: string;
};

type StoredSource = ApprovedSourceAdapter & {
  readonly sourceId: string;
  readonly chunks: readonly StoredChunk[];
  readonly tokenChunkPositions: ReadonlyMap<string, readonly number[]>;
};

const sourceSchema = z.object({
  sourceType: z.string(),
  sourceKey: z.string().trim().min(1).max(128),
  locale: z.enum(retrievalLocales),
  version: z.string().trim().min(1).max(64),
  canonicalUrl: z.string().trim().min(1),
  text: z.string().min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/u),
  approvalState: z.enum(["approved", "pending", "rejected"]),
  visibility: z.enum(["public", "internal"]),
  isActive: z.boolean(),
}).strict();

const retrievalOptionsSchema = z.object({
  query: z.string(),
  locale: z.enum(retrievalLocales),
  maxResults: z.number().finite().int().nonnegative().optional(),
  maxTextChars: z.number().finite().int().nonnegative().optional(),
}).strict();

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function canonicalizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") return undefined;
    url.hostname = url.hostname.toLowerCase();
    url.port = url.port === "443" ? "" : url.port;
    url.pathname = url.pathname.replace(/\/+(?=$|\?)/u, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeSourceText(text: string): string {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/!?(\[[^\]]*\])\([^)]*\)/gu, "$1")
    .replace(/https?:\/\/[^\s)]+/giu, " ")
    .replace(/<[^>]*>/gu, " ")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseSource(input: unknown):
  | { readonly ok: true; readonly source: ApprovedSourceAdapter }
  | { readonly ok: false } {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success || !isApprovedSourceType(parsed.data.sourceType)) return { ok: false };
  const canonicalUrl = canonicalizeUrl(parsed.data.canonicalUrl);
  const text = normalizeSourceText(parsed.data.text);
  if (canonicalUrl === undefined || text.length === 0 || sha256Text(text) !== parsed.data.contentHash) return { ok: false };
  return {
    ok: true,
    source: { ...parsed.data, sourceType: parsed.data.sourceType, canonicalUrl, text },
  };
}

function isApprovedSourceType(value: string): value is ApprovedSourceType {
  return approvedSourceTypes.some((sourceType) => sourceType === value);
}

function sourceIdentity(source: Pick<ApprovedSourceAdapter, "sourceType" | "sourceKey" | "locale" | "canonicalUrl" | "version">): string {
  const components = [source.sourceType, source.sourceKey, source.locale, source.canonicalUrl, source.version] as const;
  return sha256Text(JSON.stringify(components));
}

function stableSourceIdentity(source: Pick<ApprovedSourceAdapter, "sourceType" | "sourceKey" | "locale" | "canonicalUrl">): string {
  const components = [source.sourceType, source.sourceKey, source.locale, source.canonicalUrl] as const;
  return sha256Text(JSON.stringify(components));
}

function tokenize(text: string): readonly string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function chunkText(text: string, chunkSize: number, sourceHash: string): readonly StoredChunk[] {
  const chunks: StoredChunk[] = [];
  let position = 0;
  for (let start = 0; start < text.length; start += chunkSize) {
    const trimmedText = text.slice(start, start + chunkSize).trim();
    if (trimmedText.length > 0) {
      chunks.push({ text: trimmedText, position, sourceHash });
    }
    position += 1;
  }
  return chunks;
}

function indexTokensByChunk(text: string, chunkSize: number): ReadonlyMap<string, readonly number[]> {
  const positions = new Map<string, number[]>();
  for (const match of text.toLocaleLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;
    const firstChunk = Math.floor(start / chunkSize);
    const lastChunk = Math.floor((end - 1) / chunkSize);
    const chunks = positions.get(token) ?? [];
    for (let position = firstChunk; position <= lastChunk; position += 1) {
      if (!chunks.includes(position)) chunks.push(position);
    }
    positions.set(token, chunks);
  }
  return positions;
}

function boundedText(text: string, maxTextChars: number): string {
  if (text.length <= maxTextChars) return text;
  const boundary = text.slice(0, maxTextChars + 1).lastIndexOf(" ");
  return text.slice(0, boundary > 0 ? boundary : maxTextChars);
}

export class ApprovedSourceStore {
  private readonly sources = new Map<string, StoredSource>();
  private readonly stableSourceIds = new Map<string, string>();
  private readonly chunkSize: number;

  public constructor(options: { readonly chunkSize?: number } = {}) {
    this.chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 800));
  }

  public ingest(input: unknown):
    | { readonly accepted: true; readonly sourceId: string; readonly invalidatedSourceId?: string }
    | { readonly accepted: false; readonly reason: "source_type_not_allowed" | "source_not_approved" | "source_not_public" | "invalid_source" } {
    if (typeof input !== "object" || input === null) return { accepted: false, reason: "invalid_source" };
    const sourceType = Reflect.get(input, "sourceType");
    if (typeof sourceType === "string" && !isApprovedSourceType(sourceType)) return { accepted: false, reason: "source_type_not_allowed" };
    const approvalState = Reflect.get(input, "approvalState");
    if (approvalState === "pending" || approvalState === "rejected") return { accepted: false, reason: "source_not_approved" };
    if (Reflect.get(input, "visibility") === "internal") return { accepted: false, reason: "source_not_public" };
    const parsed = parseSource(input);
    if (!parsed.ok || !parsed.source.isActive || parsed.source.approvalState !== "approved" || parsed.source.visibility !== "public") return { accepted: false, reason: "invalid_source" };

    const source = parsed.source;
    const sourceId = sourceIdentity(source);
    const stableIdentity = stableSourceIdentity(source);
    const previousSourceId = this.stableSourceIds.get(stableIdentity);
    const previous = previousSourceId === undefined ? undefined : this.sources.get(previousSourceId);
    if (previous?.sourceId === sourceId && previous.contentHash === source.contentHash) return { accepted: true, sourceId };
    this.sources.set(sourceId, {
      ...source,
      sourceId,
      chunks: chunkText(source.text, this.chunkSize, source.contentHash),
      tokenChunkPositions: indexTokensByChunk(source.text, this.chunkSize),
    });
    this.stableSourceIds.set(stableIdentity, sourceId);
    if (previousSourceId !== undefined && previousSourceId !== sourceId) this.sources.delete(previousSourceId);
    return previous === undefined ? { accepted: true, sourceId } : { accepted: true, sourceId, invalidatedSourceId: previous.sourceId };
  }

  public retrieve(options: unknown): readonly RetrievedEvidence[] {
    const parsedOptions = retrievalOptionsSchema.safeParse(options);
    if (!parsedOptions.success) return [];
    const retrievalOptions = parsedOptions.data;
    const queryTokens = [...new Set(tokenize(retrievalOptions.query))];
    if (queryTokens.length === 0) return [];
    const maxResults = Math.min(retrievalOptions.maxResults ?? 8, 12);
    const maxTextChars = Math.max(1, Math.min(retrievalOptions.maxTextChars ?? 2_000, 12_000));
    const rank = (locale: RetrievalLocale): readonly { readonly source: StoredSource; readonly chunk: StoredChunk; readonly score: number }[] => [...this.sources.values()]
      .filter((source) => source.locale === locale)
      .flatMap((source) => source.chunks.flatMap((chunk) => {
        const score = queryTokens.reduce((total, token) => total + (source.tokenChunkPositions.get(token)?.includes(chunk.position) === true ? 1 : 0), 0);
        return score === 0 ? [] : [{ source, chunk, score }];
      }))
      .sort((left, right) => right.score - left.score || left.source.sourceId.localeCompare(right.source.sourceId) || left.chunk.position - right.chunk.position);
    const ranked = rank(retrievalOptions.locale);
    const candidates = ranked.length > 0 ? ranked : rank("en");
    let remaining = maxTextChars;
    return candidates.slice(0, maxResults).flatMap(({ source, chunk, score }) => {
      if (remaining <= 0) return [];
      const text = boundedText(chunk.text, remaining);
      remaining -= text.length;
      return [{ sourceId: source.sourceId, canonicalUrl: source.canonicalUrl, locale: source.locale, text, score, position: chunk.position, isInstruction: false }];
    });
  }
}
