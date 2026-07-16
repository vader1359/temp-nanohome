import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  createPublicClient: vi.fn(() => ({
    from: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: { code: "PGRST205", details: null, hint: null, message: "CMS relation is unavailable" },
      })),
      select: vi.fn(function () { return this; }),
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({ createPublicClient: state.createPublicClient }));
vi.mock("next/cache", () => ({ unstable_cache: (loader: (locale: "en" | "ko" | "vi") => Promise<unknown>) => loader }));

import { getHomepageCms } from "./homepage-cms";

describe("getHomepageCms unavailable schema fallback", () => {
  it("returns the static-safe empty model when PostgREST has not loaded CMS relations", async () => {
    // Given: the configured Supabase project has not applied the CMS schema.
    // When: the homepage loads its optional CMS model.
    const model = await getHomepageCms("en");

    // Then: the static homepage remains renderable.
    expect(model).toEqual({ sections: [] });
  });
});
