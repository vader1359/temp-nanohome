import { describe, expect, it } from "vitest";
import { consentRequestSchema } from "./schema";
import { createConsentService } from "./service";

describe("consent service", () => {
  it("Given no ledger events, When projecting consent, Then every optional frozen purpose is off", () => {
    const service = createConsentService();

    expect(service.project("visitor-1")).toEqual({
      analytics: false,
      personalization: false,
      aiProcessing: false,
      aiConversationStorage: false,
      roomImageProcessing: false,
      roomImageStorage: false,
      version: "1",
    });
  });

  it("Given a marketing grant, When projecting the frozen client consent, Then marketing remains only an internal capability", () => {
    const parsed = consentRequestSchema.parse({
      analytics: true,
      marketing: true,
      version: "2",
      locale: "en",
      source: "banner",
    });
    const service = createConsentService();

    service.record("visitor-1", parsed);

    expect(service.project("visitor-1")).toMatchObject({ analytics: true, version: "2" });
    expect(service.project("visitor-1")).not.toHaveProperty("marketing");
    expect(service.current("visitor-1").marketing).toBe(true);
  });

  it("Given unknown or PII consent fields, When parsing, Then the request is rejected", () => {
    expect(consentRequestSchema.safeParse({ analytics: true, email: "a@example.com" }).success).toBe(false);
    expect(consentRequestSchema.safeParse({ analytics: true, unknown: true }).success).toBe(false);
  });

  it("rejects partial withdrawal requests", () => {
    expect(consentRequestSchema.safeParse({ withdrawn: true, version: "2" }).success).toBe(false);
    expect(consentRequestSchema.safeParse({ withdrawalReason: "user request", version: "2" }).success).toBe(false);
  });

  it("turns every optional purpose and marketing capability off after withdrawal", () => {
    const service = createConsentService();
    service.record("visitor-1", consentRequestSchema.parse({ analytics: true, personalization: true, roomImageProcessing: true, marketing: true, version: "2", withdrawn: true, withdrawalReason: "user request" }));

    expect(service.current("visitor-1")).toMatchObject({ analytics: false, personalization: false, roomImageProcessing: false, marketing: false, withdrawn: true });
    expect(service.capabilities("visitor-1")).toEqual({ analyticsTracking: false, marketingTracking: false });
  });
});
