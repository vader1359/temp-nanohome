import { describe, expect, it, vi } from "vitest";
import { AccountId } from "@/lib/account-session";
import type { CustomerMemory, RecommendationResponse } from "@/lib/contracts";
import { createPersonalizationResolver, selectPersonalizedModules } from "./index";

const memory: CustomerMemory = {
  linkId: "link-1",
  preferredRoomIds: ["bedroom"],
  preferredBrandIds: ["brand-memory"],
  discussedVariantIds: ["variant-memory"],
  purchasedVariantIds: [],
  sourceUpdatedAt: "2026-07-21T00:00:00.000Z",
};

const recommendation: RecommendationResponse = {
  requestId: "pdp:variant-current:2026-07-22T00:00:00.000Z",
  algorithmVersion: "pdp-deterministic-v1",
  generatedAt: "2026-07-22T00:00:00.000Z",
  fallbackTier: "tier_1_structured_catalog",
  placement: "pdp",
  items: [{ variantId: "variant-related", reasonCode: "similar_price_band" }],
};

const accountId = new AccountId("11111111-1111-4111-8111-111111111111");

const baseInput = {
  accountId: null,
  consent: { personalization: false },
  locale: "en",
  recent: [],
  explicit: [],
  now: "2026-07-22T00:00:00.000Z",
};

const enabledFlags = {
  personalizationEnabled: true,
  recentlyViewedEnabled: true,
  explicitPreferencesEnabled: true,
  customerMemoryEnabled: true,
};

const enabledSettings = {
  enabled: true,
  useAmisHistory: true,
  useBehaviorHistory: true,
  policyVersion: "plan03-test-v1",
};

describe("local personalization domain", () => {
  it("Given default-off flags, When context resolves, Then it returns the curated default without loading memory", async () => {
    const memoryPort = { getForAuthenticatedCustomer: vi.fn() };
    const resolver = createPersonalizationResolver({ memoryPort });

    const result = await resolver.resolve(baseInput);

    expect(result.mode).toBe("default");
    expect(result.customerMemory).toBeUndefined();
    expect(result.explanationKeys).toEqual(["curated_default"]);
    expect(memoryPort.getForAuthenticatedCustomer).not.toHaveBeenCalled();
  });

  it("Given enabled settings without personalization consent, When context resolves, Then it returns the curated default", async () => {
    const resolver = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn() },
      flags: enabledFlags,
      settings: enabledSettings,
    });

    const result = await resolver.resolve({
      ...baseInput,
      recent: [{ entityType: "variant", entityId: "variant-recent" }],
    });

    expect(result.mode).toBe("default");
    expect(result.recent).toEqual([]);
    expect(result.explanationKeys).toEqual(["curated_default"]);
  });

  it("Given enabled flags but no settings, When context resolves, Then it returns the curated default", async () => {
    const resolver = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn() },
      flags: enabledFlags,
    });

    const result = await resolver.resolve({
      ...baseInput,
      consent: { personalization: true },
      recent: [{ entityType: "variant", entityId: "variant-recent" }],
      explicit: [{ key: "room", value: "living-room", labelKey: "selected_room" }],
    });

    expect(result).toMatchObject({
      mode: "default",
      explicit: [],
      recent: [],
      explanationKeys: ["curated_default"],
    });
  });

  it("Given consented enabled explicit preferences, When context resolves, Then explicit features and truthful labels are returned", async () => {
    const resolver = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn() },
      flags: enabledFlags,
      settings: enabledSettings,
    });

    const result = await resolver.resolve({
      ...baseInput,
      consent: { personalization: true },
      explicit: [{ key: "room", value: "living-room", labelKey: "selected_room" }],
    });

    expect(result.mode).toBe("explicit");
    expect(result.explicit).toEqual([{ key: "room", value: "living-room", labelKey: "selected_room" }]);
    expect(result.explanationKeys).toEqual(["selected_room"]);
  });

  it("Given an authenticated consented customer and enabled memory, When context resolves, Then it uses the Plan 03 authenticated contract", async () => {
    const memoryPort = { getForAuthenticatedCustomer: vi.fn().mockResolvedValue(memory) };
    const resolver = createPersonalizationResolver({ memoryPort, flags: enabledFlags, settings: enabledSettings });

    const result = await resolver.resolve({
      ...baseInput,
      accountId,
      consent: { personalization: true },
    });

    expect(result.mode).toBe("customer_memory");
    expect(result.customerMemory).toEqual(memory);
    expect(result.explanationKeys).toEqual(["customer_memory"]);
    expect(memoryPort.getForAuthenticatedCustomer).toHaveBeenCalledWith({ accountId, purpose: "personalization" });
  });

  it("Given explicit preferences and customer memory, When context resolves, Then explicit preference remains first", async () => {
    const resolver = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn().mockResolvedValue(memory) },
      flags: enabledFlags,
      settings: enabledSettings,
    });

    const result = await resolver.resolve({
      ...baseInput,
      accountId,
      consent: { personalization: true },
      explicit: [{ key: "room", value: "living-room", labelKey: "selected_room" }],
    });

    expect(result.mode).toBe("hybrid");
    expect(result.roomSceneIds).toEqual([]);
    expect(result.explicit[0]?.value).toBe("living-room");
    expect(result.explanationKeys).toEqual(["selected_room", "customer_memory"]);
  });

  it("Given a missing, unavailable, or stale memory response, When context resolves, Then no memory influence remains", async () => {
    const unavailable = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn().mockRejectedValue(new Error("outage")) },
      flags: enabledFlags,
      settings: enabledSettings,
    });
    const missing = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn().mockResolvedValue(null) },
      flags: enabledFlags,
      settings: enabledSettings,
    });
    const stale = createPersonalizationResolver({
      memoryPort: { getForAuthenticatedCustomer: vi.fn().mockResolvedValue(memory) },
      maxMemoryAgeMs: 1,
      flags: enabledFlags,
      settings: enabledSettings,
    });
    const input = { ...baseInput, accountId, consent: { personalization: true } };

    await expect(unavailable.resolve(input)).resolves.toMatchObject({ mode: "default" });
    await expect(missing.resolve(input)).resolves.toMatchObject({ mode: "default" });
    await expect(stale.resolve(input)).resolves.toMatchObject({ mode: "default" });
  });

  it("Given a non-PDP placement or recommendation outage, When modules are selected, Then the fixed curated inventory is used", async () => {
    const recommendationPort = { recommend: vi.fn().mockRejectedValue(new Error("unavailable")) };
    const resolver = createPersonalizationResolver({ memoryPort: { getForAuthenticatedCustomer: vi.fn() } });
    const context = await resolver.resolve(baseInput);

    await expect(selectPersonalizedModules({ context, placement: "home" })).resolves.toEqual({
      source: "curated",
      moduleIds: ["featured-products", "editorial-default"],
      explanationKeys: ["curated_default"],
    });
    await expect(selectPersonalizedModules({ context, placement: "pdp", currentVariantId: "variant-current", locale: "en", recommendationPort })).resolves.toEqual({
      source: "curated",
      moduleIds: ["featured-products", "editorial-default"],
      explanationKeys: ["curated_default"],
    });
    expect(recommendationPort.recommend).toHaveBeenCalledTimes(1);
  });

  it("Given a PDP and a healthy recommendation port, When modules are selected, Then only PDP recommendations are requested", async () => {
    const recommendationPort = { recommend: vi.fn().mockResolvedValue(recommendation) };
    const resolver = createPersonalizationResolver({ memoryPort: { getForAuthenticatedCustomer: vi.fn() } });
    const context = await resolver.resolve({ ...baseInput, consent: { personalization: true } });

    await expect(selectPersonalizedModules({ context, placement: "pdp", currentVariantId: "variant-current", locale: "en", recommendationPort })).resolves.toEqual({
      source: "recommendation",
      moduleIds: ["pdp-related:variant-related"],
      explanationKeys: ["recommendation_reason:similar_price_band"],
    });
    expect(recommendationPort.recommend).toHaveBeenCalledWith({ placement: "pdp", contextVariantIds: ["variant-current"], locale: "en" });
  });
});
