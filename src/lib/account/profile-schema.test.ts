import { describe, expect, it } from "vitest";

import { parseProfilePatch } from "./profile-schema";

describe("parseProfilePatch", () => {
  it("normalizes changed editable values and omits unchanged fields", () => {
    // Given: a partial browser patch with Unicode and whitespace.
    const input = {
      fullName: "  Cafe\u0301  An  ",
      nationality: "  Việt Nam ",
    };

    // When: the Account profile boundary parses it.
    const result = parseProfilePatch(input);

    // Then: it emits only normalized editable changes.
    expect(result).toEqual({
      ok: true,
      value: { fullName: "Café  An", nationality: "Việt Nam" },
    });
  });

  it("clears optional values when the browser submits an empty string", () => {
    // Given: a user clearing their optional form of address.
    const input = { formOfAddress: "   " };

    // When: the Account profile boundary parses the patch.
    const result = parseProfilePatch(input);

    // Then: it represents the requested clearing as null.
    expect(result).toEqual({ ok: true, value: { formOfAddress: null } });
  });

  it("rejects read-only verified contact fields", () => {
    // Given: a browser attempting to change its verified email through profile.
    const input = { primaryEmail: "other@example.com" };

    // When: the Account profile boundary parses the patch.
    const result = parseProfilePatch(input);

    // Then: it returns field errors and preserves the submitted input.
    expect(result).toEqual({
      ok: false,
      fieldErrors: { primaryEmail: "Trường này chỉ có thể thay đổi trong Bảo mật." },
      submitted: input,
    });
  });
});
