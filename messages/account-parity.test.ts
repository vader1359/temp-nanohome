import en from "./en.json";
import ko from "./ko.json";
import vi from "./vi.json";
import { describe, expect, it } from "vitest";

function accountKeys(messages: Readonly<Record<string, unknown>>): string[] {
  const account = messages.Account;

  if (typeof account !== "object" || account === null || Array.isArray(account)) {
    return [];
  }

  return Object.entries(account)
    .flatMap(([section, values]) => typeof values === "object" && values !== null && !Array.isArray(values)
      ? Object.keys(values).map((key) => `${section}.${key}`)
      : [section])
    .sort();
}

describe("Account message parity", () => {
  it("keeps the stable Account namespace aligned across supported locales", () => {
    // Given: the supported localized message catalogs.
    const englishKeys = accountKeys(en);

    // When: their Account namespace key paths are compared.
    const localizedKeys = [vi, ko].map(accountKeys);

    // Then: every locale supports the delivered Account UI surface.
    expect(englishKeys).not.toEqual([]);
    expect(localizedKeys).toEqual([englishKeys, englishKeys]);
  });
});
