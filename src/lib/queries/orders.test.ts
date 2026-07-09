import { describe, expect, it } from "vitest";

import { getOrdersByUserId } from "./orders";

describe("getOrdersByUserId", () => {
  it("remains available as the supported order query", () => {
    expect(getOrdersByUserId).toBeTypeOf("function");
  });
});
