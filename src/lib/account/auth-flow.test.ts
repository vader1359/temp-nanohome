import { describe, expect, it } from "vitest";

import { safeAccountReturnTo } from "./auth-flow";

describe("safeAccountReturnTo", () => {
  it("keeps a locale-prefixed local path and removes stale auth drawer state", () => {
    expect(safeAccountReturnTo("vi", "/vi/products?category=chairs&auth=login"))
      .toBe("/vi/products?category=chairs");
  });

  it.each([
    "https://attacker.test/steal",
    "//attacker.test/steal",
    "/en/account",
    "/video",
    undefined,
  ])("rejects an external, cross-locale, or prefix-confused path %#", (candidate) => {
    expect(safeAccountReturnTo("vi", candidate)).toBe("/vi");
  });
});
