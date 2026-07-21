import { describe, expect, it } from "vitest";
import { createEventRecorder, parseCustomerEvent } from "./service";

describe("customer events", () => {
  it("accepts every Plan 01 allowlisted event with safe properties", () => {
    const events = [
      { name: "page_viewed", properties: { routeKey: "/", locale: "vi" } },
      { name: "product_viewed", properties: { productId: "p1", variantId: "v1", placement: "pdp" } },
      { name: "search_submitted", properties: { filterKeys: ["brand"], resultCountBucket: "1-9" } },
      { name: "recommendation_impression", properties: { requestId: "r1", placement: "home", itemIds: ["v1"] } },
      { name: "recommendation_clicked", properties: { requestId: "r1", itemId: "v1", rank: 1 } },
      { name: "cart_item_added", properties: { variantId: "v1", sourcePlacement: "pdp" } },
      { name: "checkout_started", properties: { cartId: "c1", itemCountBucket: "1" } },
      { name: "preference_updated", properties: { preferenceKeys: ["style"] } },
      { name: "room_analysis_confirmed", properties: { analysisId: "a1", correctionFlags: ["room_type"] } },
    ] as const;

    expect(events.every((event) => parseCustomerEvent(event).success)).toBe(true);
  });

  it("accepts an allowlisted event with bounded properties", () => {
    const parsed = parseCustomerEvent({
      name: "page_viewed",
      properties: { routeKey: "/vi", locale: "vi" },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown, PII, and oversized event data", () => {
    expect(parseCustomerEvent({ name: "unknown", properties: {} }).success).toBe(false);
    expect(parseCustomerEvent({ name: "page_viewed", properties: { email: "a@example.com" } }).success).toBe(false);
    expect(parseCustomerEvent({ name: "page_viewed", properties: { routeKey: "x".repeat(300), locale: "vi" } }).success).toBe(false);
  });

  it("rejects forged identity while rejecting other unknown fields", () => {
    const result = parseCustomerEvent({
      name: "page_viewed",
      visitorId: "forged-visitor",
      sessionId: "forged-session",
      userId: "forged-user",
      properties: { routeKey: "/", locale: "vi" },
    });

    expect(result.success).toBe(false);
    expect(parseCustomerEvent({ name: "page_viewed", debug: true, properties: { routeKey: "/", locale: "vi" } }).success).toBe(false);
  });

  it("denies collection when an approved rate policy is absent", () => {
    const recorder = createEventRecorder(() => undefined);
    const result = recorder({
      name: "page_viewed",
      properties: { routeKey: "/", locale: "vi" },
      identity: { visitorId: "visitor", sessionId: "session", userId: null },
      receivedAt: "2026-07-21T00:00:00.000Z",
      idempotencyKey: "k".repeat(16),
    }, { essential: true, analytics: true });

    expect(result.kind).toBe("policy_unavailable");
  });

  it("records server identity and receive time under an explicit policy", () => {
    const recorded: Array<unknown> = [];
    const recorder = createEventRecorder((event) => { recorded.push(event); }, { limit: 1, windowMs: 60_000 });
    const result = recorder({
      name: "page_viewed",
      properties: { routeKey: "/", locale: "vi" },
      identity: { visitorId: "visitor", sessionId: "session", userId: null },
      receivedAt: "2026-07-21T00:00:00.000Z",
      idempotencyKey: "k".repeat(16),
    }, { essential: true, analytics: true });

    expect(result.kind).toBe("accepted");
    expect(recorded).toHaveLength(1);
  });

  it.each(["cart_item_added", "checkout_started"] as const)("accepts essential %s without analytics consent", (name) => {
    const recorder = createEventRecorder(() => undefined, { limit: 1, windowMs: 60_000 });
    const event = name === "cart_item_added"
      ? { name, properties: { variantId: "v1", sourcePlacement: "cart" } }
      : { name, properties: { cartId: "c1", itemCountBucket: "1" } };

    expect(recorder({ ...event, identity: { visitorId: "visitor", sessionId: name, userId: null }, receivedAt: "2026-07-21T00:00:00.000Z", idempotencyKey: "k".repeat(16) }, { essential: true })).toEqual({ kind: "accepted" });
  });

  it("requires room image processing and personalization for room analysis", () => {
    const recorder = createEventRecorder(() => undefined, { limit: 2, windowMs: 60_000 });
    const event = { name: "room_analysis_confirmed" as const, properties: { analysisId: "a1", correctionFlags: [] }, identity: { visitorId: "visitor", sessionId: "room", userId: null }, receivedAt: "2026-07-21T00:00:00.000Z", idempotencyKey: "k".repeat(16) };

    expect(recorder(event, { essential: true, roomImageProcessing: true })).toEqual({ kind: "consent_denied" });
    expect(recorder(event, { essential: true, roomImageProcessing: true, personalization: true })).toEqual({ kind: "accepted" });
  });
});
