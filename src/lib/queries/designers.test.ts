import { describe, expect, it } from "vitest";

import { getDesignerBySlug, getDesigners, getProductsByDesignerSlug } from "./designers";

describe("designers exports", () => {
  it("imports every designer query export", () => {
    expect(getDesigners).toBeTypeOf("function");
    expect(getDesignerBySlug).toBeTypeOf("function");
    expect(getProductsByDesignerSlug).toBeTypeOf("function");
  });
});
