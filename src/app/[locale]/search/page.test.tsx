import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  searchDesigners: vi.fn(async () => []),
  searchNews: vi.fn(async () => []),
  searchProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/queries/search", () => ({ searchProducts: state.searchProducts }));
vi.mock("@/lib/queries/news", () => ({ searchNews: state.searchNews }));
vi.mock("@/lib/queries/designers", () => ({ searchDesigners: state.searchDesigners }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, values?: { readonly query: string }) => values ? `${key}:${values.query}` : key),
  setRequestLocale: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}));

import SearchPage from "./page";

describe("localized aggregate search route", () => {
  it("does not query sources for a blank term", async () => {
    // Given: an empty search request.
    // When: the localized route renders.
    const page = await SearchPage({
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({ q: "   " }),
    });

    // Then: no data source is queried for the initial search state.
    expect(page).toBeDefined();
    expect(state.searchProducts).not.toHaveBeenCalled();
    expect(state.searchNews).not.toHaveBeenCalled();
    expect(state.searchDesigners).not.toHaveBeenCalled();
  });
});
