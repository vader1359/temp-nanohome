import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildZaloPaySignatures, verifyZaloPayCallback } from "./zalopay-signing";

const hmac = (key: string, input: string): string => createHmac("sha256", key).update(input).digest("hex");

describe("ZaloPay signing", () => {
  it("uses the exact Key1 inputs for create, query, and refund", () => {
    const signatures = buildZaloPaySignatures({
      key1: "key-1",
      appId: 2554,
      appTransId: "260722-order-42",
      appUser: "guest-7",
      amount: 125000,
      appTime: 1720000000000,
      embedData: "{\"redirecturl\":\"https://shop.test\"}",
      item: "[]",
      zpTransId: "260722000001",
    });

    expect(signatures.create).toBe(hmac("key-1", "2554|260722-order-42|guest-7|125000|1720000000000|{\"redirecturl\":\"https://shop.test\"}|[]"));
    expect(signatures.query).toBe(hmac("key-1", "2554|260722-order-42|key-1"));
    expect(signatures.refund).toBe(hmac("key-1", "2554|260722000001|125000|key-1"));
  });

  it("verifies the raw callback data with a constant-time MAC comparison", () => {
    const rawData = "{\"appid\":2554,\"apptransid\":\"260722-order-42\",\"amount\":125000}";
    const mac = hmac("key-2", rawData);

    expect(verifyZaloPayCallback({ rawData, mac, key2: "key-2" })).toBe(true);
    expect(verifyZaloPayCallback({ rawData, mac: `${mac.slice(0, -1)}0`, key2: "key-2" })).toBe(false);
  });
});
