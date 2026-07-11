import { describe, expect, it } from "vitest";

import { localizedArray, localizedText } from "./content";

describe("localizedText", () => {
  it("prefers Korean content for Korean routes", () => {
    // Given: content translated into all supported locales.
    const content = { en: "English", ko: "한국어", vi: "Tiếng Việt" };

    // When: the Korean route resolves it.
    const result = localizedText(content, "ko");

    // Then: the Korean translation is rendered.
    expect(result).toBe("한국어");
  });

  it("falls back from missing Korean content to Vietnamese then English", () => {
    // Given: records missing Korean content with Vietnamese and English alternatives.
    const withVietnamese = { en: "English", ko: null, vi: "Tiếng Việt" };
    const withEnglishOnly = { en: "English", ko: "  ", vi: null };

    // When: Korean routes resolve each record.
    const vietnameseFallback = localizedText(withVietnamese, "ko");
    const englishFallback = localizedText(withEnglishOnly, "ko");

    // Then: the supported fallback order is stable.
    expect(vietnameseFallback).toBe("Tiếng Việt");
    expect(englishFallback).toBe("English");
  });
});

describe("localizedArray", () => {
  it("prefers non-empty Korean arrays and falls back when absent", () => {
    // Given: localized room lists with and without Korean values.
    const koreanRooms = { en: ["Living Room"], ko: ["거실"], vi: ["Phòng khách"] };
    const fallbackRooms = { en: ["Living Room"], ko: [], vi: ["Phòng khách"] };

    // When: Korean routes resolve the room lists.
    const translated = localizedArray(koreanRooms, "ko");
    const fallback = localizedArray(fallbackRooms, "ko");

    // Then: Korean values win and Vietnamese remains the first fallback.
    expect(translated).toEqual(["거실"]);
    expect(fallback).toEqual(["Phòng khách"]);
  });
});
