import { createHash } from "node:crypto";

import { z } from "zod";

import { parseKoreanBackfillInput } from "./contract";

const draftSchema = z.object({
  id: z.string().uuid(),
  table: z.string().min(1),
  column: z.string().min(1),
  sourceLanguage: z.union([z.literal("vi"), z.literal("en")]),
  source: z.union([z.string(), z.array(z.string())]),
  translation: z.union([z.string(), z.array(z.string())]),
}).strict();

export type KoreanBackfillUpdate = Readonly<{
  readonly id: string;
  readonly table: string;
  readonly column: string;
  readonly value: string | readonly string[];
}>;

export class KoreanBackfillArtifactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KoreanBackfillArtifactError";
  }
}

function parseLines(content: string): readonly unknown[] {
  return content.split(/\r?\n/).filter((line) => line.trim() !== "").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new KoreanBackfillArtifactError(`invalid JSONL at line ${index + 1}`);
    }
  });
}

export function approvedKoreanBackfillUpdates(
  content: string,
  expectedSha256: string,
): readonly KoreanBackfillUpdate[] {
  const actualSha256 = createHash("sha256").update(content).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new KoreanBackfillArtifactError("approved artifact SHA-256 mismatch");
  }

  const keys = new Set<string>();
  return parseLines(content).map((record, index) => {
    const draft = draftSchema.parse(record);
    const input = parseKoreanBackfillInput({
      id: draft.id,
      table: draft.table,
      column: draft.column,
      source: { vi: draft.translation },
    });
    const key = `${input.target.table}:${input.target.column}:${input.id}`;
    if (keys.has(key)) {
      throw new KoreanBackfillArtifactError(`duplicate artifact target at line ${index + 1}`);
    }
    keys.add(key);
    return {
      id: input.id,
      table: input.target.table,
      column: input.target.column,
      value: input.source.value,
    };
  });
}

export function koreanBackfillChunks(
  updates: readonly KoreanBackfillUpdate[],
  chunkSize: number,
): readonly (readonly KoreanBackfillUpdate[])[] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 250) {
    throw new KoreanBackfillArtifactError("chunk size must be between 1 and 250");
  }

  const chunks: KoreanBackfillUpdate[][] = [];
  for (let index = 0; index < updates.length; index += chunkSize) {
    chunks.push(updates.slice(index, index + chunkSize));
  }
  return chunks;
}
