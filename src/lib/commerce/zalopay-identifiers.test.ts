import { describe, expect, it } from "vitest";

import { createZaloPayIdentifiers } from "./zalopay-identifiers";

describe("ZaloPay identifiers", () => {
  it("uses Vietnam yymmdd and an injected id", () => {
    const identifiers = createZaloPayIdentifiers({
      clock: () => new Date("2026-07-21T17:30:00.000Z"),
      nextId: () => "order-42",
    });

    expect(identifiers.appTransId()).toBe("260722-order-42");
  });
});
