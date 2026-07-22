import { describe, expect, it } from "vitest";

import { invokeCheckoutRoute } from "./route-invocation";

describe("checkout route invocation", () => {
  it("returns unauthorized without an owner", async () => {
    const response = await invokeCheckoutRoute({
      body: { selections: [], contact: {}, idempotencyKey: "key-1" },
      owner: null,
      checkout: async () => ({ kind: "conflict" as const }),
    });

    expect(response).toEqual({ status: 401, body: { kind: "unauthorized" } });
  });

  it("returns a deny-safe response when the service reports a conflict", async () => {
    const response = await invokeCheckoutRoute({
      body: { selections: [], contact: {}, idempotencyKey: "key-1" },
      owner: { kind: "guest", id: "visitor-1" },
      checkout: async () => ({ kind: "conflict" as const }),
    });

    expect(response).toEqual({ status: 409, body: { kind: "conflict" } });
  });
});
