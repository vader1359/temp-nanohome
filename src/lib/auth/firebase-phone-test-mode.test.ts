import { describe, expect, it } from "vitest";

import { isFirebasePhoneTestModeAllowed } from "./firebase-phone-test-mode";

describe("isFirebasePhoneTestModeAllowed", () => {
  const eligible = {
    origin: "https://staging.nanohome.vn",
    projectId: "temp-nanohome",
    stagingTestClaim: true,
  } as const;

  it("allows only the dedicated staging fixture context", () => {
    expect(isFirebasePhoneTestModeAllowed(eligible)).toBe(true);
  });

  it.each([
    { ...eligible, origin: "https://nanohome.vn" },
    { ...eligible, projectId: "nanohome-production" },
    { ...eligible, stagingTestClaim: false },
    { ...eligible, stagingTestClaim: undefined },
  ])("keeps app verification enabled outside the exact fixture context", (input) => {
    expect(isFirebasePhoneTestModeAllowed(input)).toBe(false);
  });
});
