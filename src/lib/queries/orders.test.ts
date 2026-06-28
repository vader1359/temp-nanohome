import { describe, expect, it } from "vitest";

import { createOrder, getOrdersByUserId } from "./orders";

describe("orders exports", () => {
  it("imports every order query export", () => {
    expect(createOrder).toBeTypeOf("function");
    expect(getOrdersByUserId).toBeTypeOf("function");
  });
});
