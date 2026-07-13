import { describe, expect, it } from "vitest";

import en from "./en.json";
import ko from "./ko.json";
import vi from "./vi.json";

const requiredSearchKeys = [
  "title",
  "label",
  "placeholder",
  "submit",
  "prompt",
  "summary",
  "products",
  "brands",
  "categories",
  "news",
  "designers",
  "emptyProducts",
  "emptyBrands",
  "emptyCategories",
  "emptyNews",
  "emptyDesigners",
  "sectionUnavailable",
  "viewAll",
  "noResults",
  "productImageAlt",
  "newsImageAlt",
  "designerImageAlt",
] as const;

describe("Search message namespace", () => {
  it("provides the complete search vocabulary in every locale", () => {
    // Given: the locale message catalogs.
    // When: search labels are inspected.
    // Then: all result sections share the same localized contract.
    expect(Object.keys(vi.Search).sort()).toEqual(requiredSearchKeys.toSorted());
    expect(Object.keys(en.Search).sort()).toEqual(requiredSearchKeys.toSorted());
    expect(Object.keys(ko.Search).sort()).toEqual(requiredSearchKeys.toSorted());
  });
});
