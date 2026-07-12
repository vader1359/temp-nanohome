import { describe, expect, it, vi } from "vitest";

const googleFontCalls = vi.hoisted(() => ({
  geist: vi.fn(() => ({ variable: "geist" })),
  geistMono: vi.fn(() => ({ variable: "geist-mono" })),
  libreFranklin: [] as Array<Record<string, unknown>>,
  notoSansKr: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/font/google", () => ({
  Geist: googleFontCalls.geist,
  Geist_Mono: googleFontCalls.geistMono,
  Libre_Franklin: (options: Record<string, unknown>) => {
    googleFontCalls.libreFranklin.push(options);
    return { variable: "libre-franklin" };
  },
  Noto_Sans_KR: (options: Record<string, unknown>) => {
    googleFontCalls.notoSansKr.push(options);
    return { variable: "noto-sans-kr" };
  },
}));

vi.mock("next/script", () => ({ default: () => null }));

import RootLayout from "./layout";

describe("RootLayout production font loading", () => {
  it("does not configure unused Geist font families", () => {
    // Given: production typography is provided by Libre Franklin and Noto Sans KR
    // When: the root layout module configures its font families
    expect(RootLayout).toBeDefined();

    // Then: unused root font assets are not emitted into every route
    expect(googleFontCalls.geist).not.toHaveBeenCalled();
    expect(googleFontCalls.geistMono).not.toHaveBeenCalled();
  });

  it("does not preload the Korean-only font on every locale route", () => {
    // Given: the locale-specific Korean font is configured from the root layout
    // When: the root layout module configures its font families
    expect(RootLayout).toBeDefined();

    // Then: Korean font bytes do not compete with non-Korean route LCP
    expect(googleFontCalls.notoSansKr).toContainEqual(expect.objectContaining({ preload: false }));
  });
});
