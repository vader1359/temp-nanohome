import { describe, expect, it } from "vitest";

import { createFakeAccountAuthFlowPort } from "./auth-flow-port";
import { parseAccountAuthFlowRequest, safeAccountReturnTo } from "./auth-flow";

describe("Account auth-flow boundary", () => {
  it("keeps only a locale-prefixed local return path and removes auth state", () => {
    // Given: a local destination containing legacy drawer state.
    const candidate = "/vi/products?category=chairs&auth=login";

    // When: the Account landing flow normalizes its return path.
    const returnTo = safeAccountReturnTo("vi", candidate);

    // Then: navigation remains local and does not reopen the old drawer.
    expect(returnTo).toBe("/vi/products?category=chairs");
  });

  it.each([
    ["magic_link", "start", "verification_required"],
    ["magic_link", "verify", "completed"],
    ["password", "start", "completed"],
    ["google", "start", "completed"],
    ["kakao", "start", "completed"],
    ["phone_otp", "start", "verification_required"],
    ["phone_otp", "verify", "completed"],
  ] as const)("supports %s through %s", async (method, action, expectedKind) => {
    // Given: a parsed Account-owned request for one supported method.
    const request = parseAccountAuthFlowRequest({
      action,
      email: "person@example.test",
      locale: "vi",
      method,
      otp: "123456",
      password: "password",
      phone: "+84901234567",
      returnTo: "/vi/account?auth=login",
    });
    const port = createFakeAccountAuthFlowPort();

    // When: the local fake performs the flow step.
    const outcome = await port.submit(request);

    // Then: it returns only a generic recoverable flow state.
    expect(outcome.kind).toBe(expectedKind);
  });

  it("rejects an external or cross-locale return path", () => {
    // Given: a request that attempts to leave the Account-local flow.
    const input = { action: "start", locale: "vi", method: "google", returnTo: "https://attacker.test" };

    // When: the request crosses the runtime boundary.
    const parsed = parseAccountAuthFlowRequest(input);

    // Then: the safe locale home is used instead.
    expect(parsed.returnTo).toBe("/vi");
  });
});
