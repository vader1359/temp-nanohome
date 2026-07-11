import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { approvedKoreanBackfillUpdates, KoreanBackfillArtifactError, koreanBackfillChunks } from "./apply";

const content = `${JSON.stringify({
  id: "00000000-0000-0000-0000-000000000001",
  table: "products",
  column: "name_ko",
  sourceLanguage: "vi",
  source: "Ghế",
  translation: "의자",
})}\n`;
const sha256 = createHash("sha256").update(content).digest("hex");

describe("approvedKoreanBackfillUpdates", () => {
  it("Given an approved artifact When parsing updates Then returns allowlisted values", () => {
    const updates = approvedKoreanBackfillUpdates(content, sha256);

    expect(updates).toEqual([{
      id: "00000000-0000-0000-0000-000000000001",
      table: "products",
      column: "name_ko",
      value: "의자",
    }]);
  });

  it("Given a modified artifact When parsing updates Then rejects the unapproved bytes", () => {
    expect(() => approvedKoreanBackfillUpdates(content, "0".repeat(64))).toThrow(KoreanBackfillArtifactError);
  });

  it("Given approved updates When chunking Then keeps every update within the RPC limit", () => {
    const updates = approvedKoreanBackfillUpdates(content, sha256);

    expect(koreanBackfillChunks(updates, 250)).toEqual([updates]);
  });
});
