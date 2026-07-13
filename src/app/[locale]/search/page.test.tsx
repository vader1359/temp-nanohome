import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  unifiedSearch: vi.fn(async () => ({
    brands: { hasError: false, items: [] },
    categories: { hasError: false, items: [] },
    designers: { hasError: false, items: [] },
    news: { hasError: false, items: [] },
    products: { hasError: false, items: [] },
    query: "",
  })),
}));

vi.mock("@/lib/queries/unified-search", () => ({ unifiedSearch: state.unifiedSearch }));
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
  it("delegates even a blank route query to the normalization boundary", async () => {
    // Given: an empty search request.
    // When: the localized route renders.
    await SearchPage({
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({ q: "   " }),
    });

    // Then: only the coordinator owns blank-query behavior.
    expect(state.unifiedSearch).toHaveBeenCalledWith("   ", "ko");
  });

  it("renders resilient results from the unified coordinator", async () => {
    // Given: products succeeded while news failed.
    state.unifiedSearch.mockResolvedValueOnce({
      brands: { hasError: false, items: [] },
      categories: { hasError: false, items: [] },
      designers: { hasError: false, items: [] },
      news: { hasError: true, items: [] },
      products: { hasError: false, items: [] },
      query: "Ikebana",
    });

    // When: the route renders the aggregate result.
    const page = await SearchPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ q: "Ikebana" }),
    });

    // Then: a partial result remains renderable.
    expect(page).toBeDefined();
  });
});
