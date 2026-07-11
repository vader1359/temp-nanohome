import { describe, expect, it, vi } from "vitest";

import { DeepSeekResponseError, requestKoreanTranslation, requestKoreanTranslationBatch } from "./deepseek";

function deepSeekResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200 },
  );
}

describe("requestKoreanTranslation", () => {
  it("accepts a valid payload wrapped in a complete JSON code fence", async () => {
    // Given: the model returns the required JSON payload inside a complete Markdown JSON fence.
    const fetcher = vi.fn(async () => deepSeekResponse('```json\n{"translation":"의자"}\n```'));

    // When: a text translation is requested.
    const translation = await requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Chair",
    });

    // Then: the fence is removed before the existing strict payload validation.
    expect(translation).toBe("의자");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries malformed JSON before returning a valid strict payload", async () => {
    // Given: an invalid non-empty model response followed by a valid response.
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(deepSeekResponse("not JSON"))
      .mockResolvedValueOnce(deepSeekResponse('{"translation":"의자"}'));

    // When: a text translation is requested.
    const translation = await requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Chair",
    });

    // Then: the malformed response is retried and only the validated payload is returned.
    expect(translation).toBe("의자");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects arbitrary prose after the bounded malformed-payload retries", async () => {
    // Given: every response contains non-JSON prose rather than the required payload.
    const fetcher = vi.fn(async () => deepSeekResponse("Korean translation: 의자"));

    // When: a text translation is requested.
    const request = requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Chair",
    });

    // Then: prose is never accepted and retries remain bounded.
    await expect(request).rejects.toEqual(expect.objectContaining({
      name: "DeepSeekResponseError",
      message: "invalid DeepSeek response JSON",
    }));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not strip an incomplete JSON code fence", async () => {
    // Given: the model response begins a JSON code fence but never closes it.
    const fetcher = vi.fn(async () => deepSeekResponse('```json\n{"translation":"의자"}'));

    // When: a text translation is requested.
    const request = requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Chair",
    });

    // Then: only a complete wrapper may be removed, so the malformed format is rejected.
    await expect(request).rejects.toEqual(expect.objectContaining({
      name: "DeepSeekResponseError",
      message: "invalid DeepSeek response JSON",
    }));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retries invalid schemas before rejecting the final response", async () => {
    // Given: every response parses as JSON but violates the strict text payload schema.
    const fetcher = vi.fn(async () => deepSeekResponse('{"translation":["의자"]}'));

    // When: a text translation is requested.
    const request = requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Chair",
    });

    // Then: schema validation remains strict and retry attempts remain bounded.
    await expect(request).rejects.toBeInstanceOf(DeepSeekResponseError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects non-Korean text after bounded retries", async () => {
    // Given: a structurally valid response that leaves translatable content in English.
    const fetcher = vi.fn(async () => deepSeekResponse('{"translation":"Matte black finish"}'));

    // When: a Korean text translation is requested.
    const request = requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Hoàn thiện màu đen mờ",
    });

    // Then: the response cannot become a draft without Korean script.
    await expect(request).rejects.toBeInstanceOf(DeepSeekResponseError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects translations that contain Japanese characters", async () => {
    // Given: a response mixes Korean prose with a Japanese phrase.
    const fetcher = vi.fn(async () => deepSeekResponse('{"translation":"디자인背后的 아이디어"}'));

    // When: a Korean text translation is requested.
    const request = requestKoreanTranslation({
      apiKey: "test-key",
      fetcher,
      kind: "text",
      source: "Ý tưởng thiết kế",
    });

    // Then: mixed Japanese output cannot enter a draft artifact.
    await expect(request).rejects.toBeInstanceOf(DeepSeekResponseError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("requestKoreanTranslationBatch", () => {
  it("returns one validated translation per batch item", async () => {
    // Given: a multi-item batch response with exact index mapping.
    const fetcher = vi.fn(async () =>
      deepSeekResponse(JSON.stringify({
        items: [
          { index: 0, translation: "의자" },
          { index: 1, translation: "테이블" },
        ],
      })),
    );

    // When: two text sources are translated together.
    const translations = await requestKoreanTranslationBatch({
      apiKey: "test-key",
      fetcher,
      items: [
        { kind: "text", source: "Ghế" },
        { kind: "text", source: "Bàn" },
      ],
    });

    // Then: each index maps back to a validated Korean string and only one request is made.
    expect(translations).toEqual(["의자", "테이블"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a batch that omits an item index", async () => {
    // Given: the model returns fewer items than requested.
    const fetcher = vi.fn(async () =>
      deepSeekResponse(JSON.stringify({
        items: [{ index: 0, translation: "의자" }],
      })),
    );

    // When: a two-item batch is requested.
    const request = requestKoreanTranslationBatch({
      apiKey: "test-key",
      fetcher,
      items: [
        { kind: "text", source: "Ghế" },
        { kind: "text", source: "Bàn" },
      ],
    });

    // Then: incomplete mapping is rejected after bounded retries.
    await expect(request).rejects.toBeInstanceOf(DeepSeekResponseError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
