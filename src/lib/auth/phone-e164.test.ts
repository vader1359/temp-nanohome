import { describe, expect, it } from "vitest";

import {
  formatInternationalPhone,
  isE164Phone,
  normalizeInternationalPhone,
  parseInternationalPhone,
} from "./phone-e164";

describe("international phone contract", () => {
  it.each([
    ["090 123 4567", "+84901234567"],
    ["+84 901-234-567", "+84901234567"],
    ["0084 (90) 123 4567", "+84901234567"],
    ["84901234567", "+84901234567"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeInternationalPhone(input)).toBe(expected);
  });

  it.each(["", "123456", "+84123456789", "0201234567", "09012345678", "+849012345678901"]) (
    "rejects invalid VN phone %s",
    (input) => expect(normalizeInternationalPhone(input)).toBeNull(),
  );

  it("parses pasted E.164 into the selected country and national value", () => {
    expect(parseInternationalPhone("+84941720075")).toEqual({
      country: { countryCode: "VN", dialCode: "+84", label: "Việt Nam" },
      e164: "+84941720075",
      nationalNumber: "0941720075",
    });
  });

  it("keeps generic claims bounded by E.164 without accepting malformed values", () => {
    expect(isE164Phone("+14155552671")).toBe(true);
    expect(isE164Phone("84901234567")).toBe(false);
    expect(isE164Phone("+8490123456789012")).toBe(false);
  });

  it("formats a VN value for display while retaining E.164 storage", () => {
    expect(formatInternationalPhone("+84941720075")).toBe("+84 941 720 075");
  });
});
