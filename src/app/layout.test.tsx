import { describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({ default: () => null }));

const localeState = vi.hoisted(() => ({ value: "vi" }));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => localeState.value),
}));

import RootLayout from "./layout";

describe("RootLayout document locale", () => {
  it.each(["vi", "en", "ko"])("uses getLocale() result for html lang: %s", async (locale) => {
    // Given: next-intl resolves current request locale
    localeState.value = locale;

    // When: root document renders
    const rendered = await RootLayout({ children: <div data-testid="child" /> });

    // Then: document language matches resolved locale
    expect(rendered.props.lang).toBe(locale);
  });
});

describe("RootLayout font loading", () => {
  it("uses a local system stack without build-time font downloads", async () => {
    const rendered = await RootLayout({ children: <div /> });
    const body = (rendered.props.children as Array<{ props: { className?: string } }>)[1];
    expect(body?.props.className).toContain("font-sans");
  });
});
