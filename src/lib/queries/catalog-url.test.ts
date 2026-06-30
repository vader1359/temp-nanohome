import { describe, expect, it } from "vitest";

import { catalogFileUrl } from "./catalog-url";

describe("catalogFileUrl", () => {
  it("accepts only HTTPS catalog URLs from approved hosts", () => {
    expect(catalogFileUrl("https://res.cloudinary.com/iant1359/file.pdf")).toBe("https://res.cloudinary.com/iant1359/file.pdf");
    expect(catalogFileUrl("javascript:alert(1)")).toBeNull();
    expect(catalogFileUrl("https://example.com/file.pdf")).toBeNull();
  });
});
