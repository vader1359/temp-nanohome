import { describe, expect, it, vi } from "vitest";

import { parseKoreanBackfillInput } from "./contract";
import { MissingDeepSeekApiKeyError, produceKoreanDrafts } from "./pipeline";

const textInput = {
  table: "products",
  id: "product-1",
  column: "name_ko",
  source: { vi: "  Ghế  ", en: "Chair" },
};

class DeferredResponse {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;

  constructor() {
    let resolvePromise: (response: Response) => void = () => {};
    this.promise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    this.resolve = resolvePromise;
  }
}

function successfulTranslation(translation: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translation }) } }] }),
    { status: 200 },
  );
}

describe("parseKoreanBackfillInput", () => {
  it("accepts only migration-backed targets and prefers Vietnamese source text", () => {
    // Given: a permitted target with both supported source languages.
    const input = textInput;

    // When: the untrusted JSONL object crosses the contract boundary.
    const parsed = parseKoreanBackfillInput(input);

    // Then: Vietnamese is normalized before English for Korean translation.
    expect(parsed.source).toEqual({ language: "vi", value: "Ghế" });
  });

  it("rejects a column that is absent from the approved migration contract", () => {
    // Given: a valid table paired with an unapproved Korean column.
    const input = { ...textInput, column: "origin_ko" };

    // When: the record is parsed.
    const parse = () => parseKoreanBackfillInput(input);

    // Then: it never becomes a draftable translation target.
    expect(parse).toThrow("approved Korean translation target");
  });
});

describe("produceKoreanDrafts", () => {
  it("fails for a missing API key before it calls fetch", async () => {
    // Given: generation is requested without credentials.
    const fetcher = vi.fn();

    // When: the draft pipeline starts.
    const run = produceKoreanDrafts([textInput], { fetcher, mode: "generate" });

    // Then: no external request is attempted.
    await expect(run).rejects.toBeInstanceOf(MissingDeepSeekApiKeyError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not call fetch in validate-only mode", async () => {
    // Given: a valid record and a fetch seam that would fail if reached.
    const fetcher = vi.fn();

    // When: validation-only mode runs.
    const result = await produceKoreanDrafts([textInput], {
      fetcher,
      mode: "validate-only",
    });

    // Then: input is validated without generating a remote draft.
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.drafts).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it("rejects an invalid model payload and excludes it from drafts", async () => {
    // Given: DeepSeek returns a response whose content is not the required JSON object.
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"translation":42}' } }] }),
        { status: 200 },
      );
    });

    // When: generation processes the valid source record.
    const result = await produceKoreanDrafts([textInput], {
      apiKey: "test-key",
      fetcher,
      mode: "generate",
    });

    // Then: the rejected payload remains in review rejections, never drafts.
    expect(result.drafts).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.reason).toContain("invalid DeepSeek response");
  });

  it("keeps at most the configured number of DeepSeek batch requests in flight", async () => {
    // Given: three valid records, batch size 1, and a transport whose responses are manually released.
    const first = new DeferredResponse();
    const second = new DeferredResponse();
    const third = new DeferredResponse();
    const responses = [first, second, third];
    const fetcher = vi.fn(() => {
      const response = responses.shift();
      if (response === undefined) {
        throw new Error("unexpected request");
      }
      return response.promise;
    });

    // When: generation starts with a bounded worker count and one record per batch.
    const run = produceKoreanDrafts(
      [textInput, { ...textInput, id: "product-2" }, { ...textInput, id: "product-3" }],
      { apiKey: "test-key", batchSize: 1, concurrency: 2, fetcher, mode: "generate" },
    );

    // Then: two requests start before either response completes, and no third starts yet.
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    first.resolve(successfulTranslation("첫 번째"));
    second.resolve(successfulTranslation("두 번째"));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    third.resolve(successfulTranslation("세 번째"));
    await expect(run).resolves.toMatchObject({ rejections: [] });
  });

  it("translates multiple records in one batch request", async () => {
    // Given: two valid records and a batch-shaped DeepSeek response.
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                items: [
                  { index: 0, translation: "첫 번째" },
                  { index: 1, translation: "두 번째" },
                ],
              }),
            },
          }],
        }),
        { status: 200 },
      );
    });

    // When: generation runs with a batch size covering both records.
    const result = await produceKoreanDrafts(
      [textInput, { ...textInput, id: "product-2" }],
      { apiKey: "test-key", batchSize: 25, concurrency: 1, fetcher, mode: "generate" },
    );

    // Then: one remote call yields two drafts and no rejections.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.rejections).toEqual([]);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((draft) => draft.translation)).toEqual(["첫 번째", "두 번째"]);
  });

  it("skips checkpointed input indices when resuming generation", async () => {
    // Given: a completed first record restored from an ignored draft artifact.
    const fetcher = vi.fn();

    // When: the same input is resumed with its index marked complete.
    const result = await produceKoreanDrafts([textInput], {
      apiKey: "test-key",
      completedIndexes: new Set([0]),
      fetcher,
      mode: "generate",
    });

    // Then: it neither repeats the remote call nor produces a duplicate draft.
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ drafts: [], rejections: [] });
  });
});
