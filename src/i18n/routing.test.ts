import { describe, expect, it } from "vitest";

import { isSupportedLocale, routing } from "./routing";

describe("i18n routing", () => {
  it("accepts only configured Vietnamese and English locales", () => {
    expect(isSupportedLocale("vi")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });

  it("requires explicit locale prefixes without browser locale detection", () => {
    expect(routing.localePrefix).toBe("always");
    expect(routing.localeDetection).toBe(false);
  });
});
