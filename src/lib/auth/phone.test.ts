import { describe, expect, it } from "vitest";

import { normalizeVietnamPhone } from "./phone";

describe("normalizeVietnamPhone", () => {
  it.each([
    ["090 123 4567", "+84901234567"],
    ["+84 901-234-567", "+84901234567"],
    ["0084 (90) 123 4567", "+84901234567"],
    ["84901234567", "+84901234567"],
  ])("normalizes %s without retaining formatting", (input, expected) => {
    expect(normalizeVietnamPhone(input)).toBe(expected);
  });

  it.each(["", "123456", "+84123456789", "0201234567", "09012345678"])(
    "rejects invalid or non-mobile input %s",
    (input) => {
      expect(normalizeVietnamPhone(input)).toBeNull();
    },
  );
});
