import { describe, expect, it } from "vitest";
import { completedIndexes, applyResolution, parseArguments } from "./korean-backfill-drafts";
import type { ArtifactState } from "./korean-backfill-drafts";
import type { KoreanDraft, KoreanDraftResolution, KoreanRejection } from "../src/lib/korean-backfill/pipeline";

describe("completedIndexes", () => {
  it("only marks successful draft indexes as complete, ignoring rejections", () => {
    // Given:
    const records = [
      { table: "products", id: "p1", column: "name_ko", source: { vi: "Bàn", en: "Table" } },
      { table: "products", id: "p2", column: "name_ko", source: { vi: "Ghế", en: "Chair" } },
      { table: "products", id: "p3", column: "name_ko", source: { vi: "Tủ", en: "Cabinet" } },
    ];
    const draft: KoreanDraft = {
      id: "p1",
      table: "products",
      column: "name_ko",
      sourceLanguage: "vi",
      source: "Bàn",
      translation: "탁자",
    };
    const rejection: KoreanRejection = {
      index: 1,
      reason: "API error",
    };
    const state: ArtifactState = {
      drafts: [draft],
      rejections: [rejection],
    };

    // When:
    const completed = completedIndexes(records, state);

    // Then:
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(false);
    expect(completed.has(2)).toBe(false);
  });
});

describe("parseArguments", () => {
  it("uses an isolated artifact directory for a repair run", () => {
    // Given: a repair command with an explicit ignored output directory.
    const argumentsList = ["repair-input.jsonl", "--artifact-dir", "artifacts/korean-backfill/repair"];

    // When: the command arguments are parsed.
    const parsed = parseArguments(argumentsList);

    // Then: the repair run cannot reuse or overwrite the baseline checkpoints.
    expect(parsed).toEqual({
      artifactDirectory: "artifacts/korean-backfill/repair",
      inputPath: "repair-input.jsonl",
      mode: "generate",
    });
  });
});

describe("applyResolution", () => {
  it("avoids duplicates by replacing existing rejection for the same index", () => {
    // Given:
    const state: ArtifactState = {
      drafts: [],
      rejections: [{ index: 2, reason: "old error" }],
    };
    const resolution: KoreanDraftResolution = {
      kind: "rejection",
      rejection: { index: 2, reason: "new error" },
    };

    // When:
    const nextState = applyResolution(state, resolution);

    // Then:
    expect(nextState.rejections).toEqual([{ index: 2, reason: "new error" }]);
  });

  it("removes rejection if index subsequently resolves as a draft", () => {
    // Given:
    const state: ArtifactState = {
      drafts: [],
      rejections: [{ index: 1, reason: "temporary error" }],
    };
    const draft: KoreanDraft = {
      id: "p2",
      table: "products",
      column: "name_ko",
      sourceLanguage: "vi",
      source: "Ghế",
      translation: "의자",
    };
    const resolution: KoreanDraftResolution = {
      kind: "draft",
      index: 1,
      draft,
    };

    // When:
    const nextState = applyResolution(state, resolution);

    // Then:
    expect(nextState.rejections).toEqual([]);
    expect(nextState.drafts).toEqual([draft]);
  });
});
