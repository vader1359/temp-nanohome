import { describe, expect, it } from "vitest";

import en from "./en.json";
import ko from "./ko.json";
import vi from "./vi.json";

describe("Checkout message namespace", () => {
  it("has matching Checkout keys for every locale", () => {
    // Given: all supported locale message files.
    const expectedKeys = flattenKeys(vi.Checkout);

    // When: each Checkout namespace is flattened.
    const localeKeys = {
      en: flattenKeys(en.Checkout),
      ko: flattenKeys(ko.Checkout),
      vi: expectedKeys,
    };

    // Then: every locale exposes the same Checkout translation contract.
    expect(localeKeys.en).toEqual(expectedKeys);
    expect(localeKeys.ko).toEqual(expectedKeys);
  });
});

function flattenKeys(value: Readonly<Record<string, unknown>>, prefix = ""): readonly string[] {
  return Object.entries(value)
    .flatMap(([key, nestedValue]) => {
      const path = prefix === "" ? key : `${prefix}.${key}`;

      if (isRecord(nestedValue)) {
        return flattenKeys(nestedValue, path);
      }

      return [path];
    })
    .sort();
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
