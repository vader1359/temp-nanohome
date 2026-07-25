import { describe, expect, it } from "vitest";

import { getAccountAuthPort, getAccountProfilePort } from "./account-ports.server";

describe("Account development ports", () => {
  it("keeps the default auth fixture anonymous", async () => {
    // Given: Account-lane development port accessors.
    const authPort = getAccountAuthPort();

    // When: the current identity is resolved.
    const account = await authPort.getAuthenticatedAccount();

    // Then: no user is fabricated outside explicit test fixtures.
    expect(account).toBeNull();
  });

  it("exposes a profile port without browser persistence", () => {
    // Given: Account-lane development port accessors.

    // When: the profile port is resolved.
    const profilePort = getAccountProfilePort();

    // Then: it has the two account-scoped operations.
    expect(profilePort.getProfile).toBeTypeOf("function");
    expect(profilePort.patchProfile).toBeTypeOf("function");
  });
});
