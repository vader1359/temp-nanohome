import { describe, expect, it } from "vitest";

import { getVariantById, getVariantsByProductId } from "./variants";

describe("variants exports", () => {
  it("imports every variant query export", () => {
    expect(getVariantById).toBeTypeOf("function");
    expect(getVariantsByProductId).toBeTypeOf("function");
  });
});
