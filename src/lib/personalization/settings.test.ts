import { describe, expect, it } from "vitest";
import { personalizationSettingsSchema, resolvePersonalizationSettings } from "./settings";

describe("personalization settings", () => {
  it("Given no persisted setting, When resolved, Then personalization remains disabled", () => {
    expect(resolvePersonalizationSettings(null)).toEqual({
      enabled: false,
      useAmisHistory: false,
      useBehaviorHistory: false,
      policyVersion: "plan03-disabled-v1",
    });
  });

  it("Given an enabled setting with sources disabled, When resolved, Then source gates remain disabled", () => {
    expect(resolvePersonalizationSettings({
      enabled: true,
      useAmisHistory: false,
      useBehaviorHistory: false,
      policyVersion: "plan03-v1",
    })).toEqual({
      enabled: true,
      useAmisHistory: false,
      useBehaviorHistory: false,
      policyVersion: "plan03-v1",
    });
  });

  it("Given a malformed setting, When parsed, Then it is rejected", () => {
    expect(personalizationSettingsSchema.safeParse({
      enabled: true,
      useAmisHistory: true,
      useBehaviorHistory: false,
      policyVersion: "plan03-v1",
      email: "private@example.test",
    }).success).toBe(false);
  });
});
