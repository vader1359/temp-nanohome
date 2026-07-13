import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";

import { catalogFileUrl } from "./catalog-url";

const supabaseStorageUrl = new URL("/storage/v1/object/public/catalogs/HAY/catalog.pdf", env.NEXT_PUBLIC_SUPABASE_URL).toString();

describe("catalogFileUrl", () => {
  it("accepts HTTPS catalog URLs from approved hosts", () => {
    // Given approved remote catalog hosts
    // When their URLs are validated
    // Then they remain available for download
    expect(catalogFileUrl("https://res.cloudinary.com/iant1359/file.pdf")).toBe("https://res.cloudinary.com/iant1359/file.pdf");
    expect(catalogFileUrl(supabaseStorageUrl)).toBe(supabaseStorageUrl);
  });

  it("rejects non-catalog URLs", () => {
    // Given unsafe or untrusted URLs
    // When they are validated
    // Then no download link is exposed
    expect(catalogFileUrl("javascript:alert(1)")).toBeNull();
    expect(catalogFileUrl("https://example.com/file.pdf")).toBeNull();
    expect(catalogFileUrl(new URL("/rest/v1/catalogs", env.NEXT_PUBLIC_SUPABASE_URL).toString())).toBeNull();
  });
});
