import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email-normalization";

describe("normalizeEmail", () => {
  it("trims, normalizes, and lowercases lookup email", () => {
    expect(normalizeEmail("  PERSON@Example.TEST ")).toBe("person@example.test");
  });

  it.each(["", "person", "person@", "person @example.test", "person@example"]) (
    "rejects malformed email %s",
    (input) => expect(normalizeEmail(input)).toBeNull(),
  );
});
