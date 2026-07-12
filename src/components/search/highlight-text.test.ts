import { describe, expect, it } from "vitest";

import { highlightText } from "./highlight-text";

describe("highlightText", () => {
  it("marks every literal case-insensitive match without interpreting regex characters", () => {
    // Given: a repeated query that contains regex syntax.
    // When: text is split into highlight segments.
    const parts = highlightText("Lamp (lamp) lamp+shade", "lamp+");

    // Then: only the literal repeated match is marked.
    expect(parts).toEqual([
      { value: "Lamp (lamp) ", matched: false },
      { value: "lamp+", matched: true },
      { value: "shade", matched: false },
    ]);
  });

  it("preserves Korean text and returns no mark for blank or absent queries", () => {
    // Given: Korean content and queries with no usable literal match.
    // When: highlighting runs.
    const absent = highlightText("프리츠 한센 의자", "조명");
    const blank = highlightText("프리츠 한센 의자", "   ");

    // Then: the source text is preserved without empty marks.
    expect(absent).toEqual([{ value: "프리츠 한센 의자", matched: false }]);
    expect(blank).toEqual([{ value: "프리츠 한센 의자", matched: false }]);
  });
});
