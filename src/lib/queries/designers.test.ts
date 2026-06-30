import { describe, expect, it } from "vitest";

import { getDesignerByAirtableId, getDesignerBySlug, getDesigners, getProductsByDesignerAirtableId, getProductsByDesignerSlug } from "./designers";

describe("designers exports", () => {
  it("imports every designer query export", () => {
    expect(getDesigners).toBeTypeOf("function");
    expect(getDesignerBySlug).toBeTypeOf("function");
    expect(getDesignerByAirtableId).toBeTypeOf("function");
    expect(getProductsByDesignerSlug).toBeTypeOf("function");
    expect(getProductsByDesignerAirtableId).toBeTypeOf("function");
  });
});
