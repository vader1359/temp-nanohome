import { describe, expect, it } from "vitest";

import en from "./en.json";
import ko from "./ko.json";
import vi from "./vi.json";

describe("Products message namespace", () => {
  it("has matching Products keys for every locale", () => {
    const expectedKeys = flattenKeys(vi.Products);

    expect(flattenKeys(en.Products)).toEqual(expectedKeys);
    expect(flattenKeys(ko.Products)).toEqual(expectedKeys);
  });
});

function flattenKeys(value: Readonly<Record<string, unknown>>, prefix = ""): readonly string[] {
  return Object.entries(value)
    .flatMap(([key, nestedValue]) => {
      const path = prefix === "" ? key : `${prefix}.${key}`;
      return isRecord(nestedValue) ? flattenKeys(nestedValue, path) : [path];
    })
    .sort();
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
