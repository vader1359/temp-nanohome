import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { parseKoreanBackfillInput } from "../src/lib/korean-backfill/contract";
import { produceKoreanDrafts } from "../src/lib/korean-backfill/pipeline";
import type { KoreanDraft, KoreanDraftResolution, KoreanRejection } from "../src/lib/korean-backfill/pipeline";

export type Arguments = Readonly<{
  artifactDirectory: string;
  inputPath: string;
  mode: "generate" | "validate-only";
}>;

const sourceValueSchema = z.union([z.string(), z.array(z.string())]);
const draftSchema = z.object({
  id: z.string().min(1),
  table: z.string().min(1),
  column: z.string().min(1),
  sourceLanguage: z.union([z.literal("vi"), z.literal("en")]),
  source: sourceValueSchema,
  translation: sourceValueSchema,
}).strict();
const rejectionSchema = z.object({ index: z.number().int().nonnegative(), reason: z.string().min(1) }).strict();

export type ArtifactState = {
  readonly drafts: KoreanDraft[];
  readonly rejections: KoreanRejection[];
};

export function parseArguments(argumentsList: readonly string[]): Arguments {
  const [inputPath, ...flags] = argumentsList;
  if (inputPath === undefined || inputPath.trim() === "") {
    throw new Error("Usage: npm run korean-backfill:drafts -- <input.jsonl> [--validate-only] [--artifact-dir <path>]");
  }
  const mode = flags.includes("--validate-only") ? "validate-only" : "generate";
  const artifactFlagIndex = flags.indexOf("--artifact-dir");
  const artifactDirectory = artifactFlagIndex === -1
    ? "artifacts/korean-backfill"
    : flags[artifactFlagIndex + 1];
  const expectedFlagCount = mode === "validate-only" ? 1 : 0;
  const artifactFlagCount = artifactFlagIndex === -1 ? 0 : 2;
  if (
    flags.length !== expectedFlagCount + artifactFlagCount
    || artifactDirectory === undefined
    || artifactDirectory.trim() === ""
  ) {
    throw new Error("Only --validate-only and --artifact-dir <path> are supported");
  }
  return { artifactDirectory, inputPath, mode };
}

function parseJsonLines(content: string): readonly unknown[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSONL at line ${index + 1}`);
      }
    });
}

function parseArtifactLines<T>(content: string, schema: z.ZodType<T>): T[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return schema.parse(JSON.parse(line));
      } catch {
        throw new Error(`Invalid checkpoint JSONL at line ${index + 1}`);
      }
    });
}

async function readCheckpoint(pathname: string): Promise<string> {
  try {
    return await readFile(pathname, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function loadArtifactState(artifactDirectory: string): Promise<ArtifactState> {
  const [draftContent, rejectionContent] = await Promise.all([
    readCheckpoint(path.join(artifactDirectory, "drafts.jsonl")),
    readCheckpoint(path.join(artifactDirectory, "rejections.jsonl")),
  ]);
  return {
    drafts: parseArtifactLines(draftContent, draftSchema),
    rejections: parseArtifactLines(rejectionContent, rejectionSchema),
  };
}

function draftKey(draft: KoreanDraft): string {
  return `${draft.table}:${draft.column}:${draft.id}`;
}

export function completedIndexes(records: readonly unknown[], state: ArtifactState): ReadonlySet<number> {
  const completedDrafts = new Set(state.drafts.map(draftKey));
  const completed = new Set<number>();

  for (const [index, record] of records.entries()) {
    try {
      const input = parseKoreanBackfillInput(record);
      if (completedDrafts.has(`${input.target.table}:${input.target.column}:${input.id}`)) {
        completed.add(index);
      }
    } catch (error) {
      if (error instanceof Error) {
        continue;
      }
      throw error;
    }
  }
  return completed;
}

function jsonLines(entries: readonly KoreanDraft[] | readonly KoreanRejection[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

async function writeAtomically(pathname: string, content: string): Promise<void> {
  const temporaryPath = `${pathname}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, pathname);
}

async function writeArtifactState(artifactDirectory: string, state: ArtifactState): Promise<void> {
  await Promise.all([
    writeAtomically(path.join(artifactDirectory, "drafts.jsonl"), jsonLines(state.drafts)),
    writeAtomically(path.join(artifactDirectory, "rejections.jsonl"), jsonLines(state.rejections)),
  ]);
}

export function applyResolution(state: ArtifactState, resolution: KoreanDraftResolution): ArtifactState {
  switch (resolution.kind) {
    case "draft": {
      const rejections = state.rejections.filter((r) => r.index !== resolution.index);
      return {
        ...state,
        drafts: [...state.drafts, resolution.draft],
        rejections,
      };
    }
    case "rejection": {
      const rejections = state.rejections.filter((r) => r.index !== resolution.rejection.index);
      return {
        ...state,
        rejections: [...rejections, resolution.rejection],
      };
    }
  }
}

async function main(): Promise<void> {
  const argumentsValue = parseArguments(process.argv.slice(2));
  const content = await readFile(path.resolve(argumentsValue.inputPath), "utf8");
  const records = parseJsonLines(content);
  const artifactDirectory = path.resolve(process.cwd(), argumentsValue.artifactDirectory);
  await mkdir(artifactDirectory, { recursive: true });
  let state = await loadArtifactState(artifactDirectory);
  let checkpointWrite = Promise.resolve();
  const queueCheckpoint = async (resolution: KoreanDraftResolution): Promise<void> => {
    const nextState = applyResolution(state, resolution);
    state = nextState;
    checkpointWrite = checkpointWrite.then(() => writeArtifactState(artifactDirectory, nextState));
    await checkpointWrite;
  };

  await produceKoreanDrafts(records, {
    apiKey: process.env.DEEPSEEK_API_KEY,
    completedIndexes: completedIndexes(records, state),
    fetcher: fetch,
    mode: argumentsValue.mode,
    onResolution: queueCheckpoint,
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
