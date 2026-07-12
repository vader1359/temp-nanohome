import { describe, expect, it, vi } from "vitest";

const googleFontCalls = vi.hoisted(() => ({
  notoSansKr: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
  Libre_Franklin: () => ({ variable: "libre-franklin" }),
  Noto_Sans_KR: (options: Record<string, unknown>) => {
    googleFontCalls.notoSansKr.push(options);
    return { variable: "noto-sans-kr" };
  },
}));

vi.mock("next/script", () => ({ default: () => null }));

import RootLayout from "./layout";

describe("RootLayout Korean font loading", () => {
  it("does not preload the Korean-only font on every locale route", () => {
    // Given: the locale-specific Korean font is configured from the root layout
    // When: the root layout module configures its font families
    expect(RootLayout).toBeDefined();

    // Then: Korean font bytes do not compete with non-Korean route LCP
    expect(googleFontCalls.notoSansKr).toContainEqual(expect.objectContaining({ preload: false }));
  });
});
