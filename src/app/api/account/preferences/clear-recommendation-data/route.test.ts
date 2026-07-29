import { beforeEach, describe, expect, it, vi } from "vitest";
import { sameOriginRequest } from "@/test/same-origin-request";

const ports = vi.hoisted(() => ({ clearRecommendationData: vi.fn(), getAuthenticatedAccount: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({ clearRecommendationData: ports.clearRecommendationData }),
}));

import { POST } from "./route";

const account = { accountId: "account_01", firebaseUid: "firebase_01", identities: [], locale: "vi" };
const preferences = { amisHistory: { available: false, enabled: false }, browsingHistoryEnabled: true, productPersonalizationEnabled: true, recommendationDataState: "cleared" };

describe("/api/account/preferences/clear-recommendation-data", () => {
  beforeEach(() => { ports.clearRecommendationData.mockReset(); ports.getAuthenticatedAccount.mockReset(); });

  it("clears account recommendation data with private headers", async () => {
    // Given: an authenticated account and a canonical clear result.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.clearRecommendationData.mockResolvedValue(preferences);

    // When: recommendation data is cleared.
    const response = await POST(sameOriginRequest("https://app.test/api/account/preferences/clear-recommendation-data", { method: "POST" }));

    // Then: the account-scoped port result is private and canonical.
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(ports.clearRecommendationData).toHaveBeenCalledWith(account);
    await expect(response.json()).resolves.toEqual(preferences);
  });

  it("rejects malformed JSON before clearing recommendation data", async () => {
    // Given: an authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(account);

    // When: malformed JSON is sent to the bodyless action.
    const response = await POST(sameOriginRequest("https://app.test/api/account/preferences/clear-recommendation-data", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    // Then: the malformed request is rejected without calling the port.
    expect(response.status).toBe(400);
    expect(ports.clearRecommendationData).not.toHaveBeenCalled();
  });

  it("hides a rejected clear-data port behind a generic private failure", async () => {
    // Given: an authenticated account whose recommendation-data port rejects with sensitive details.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.clearRecommendationData.mockRejectedValue(new Error("recommendation data failure"));

    // When: recommendation data is cleared.
    const response = await POST(sameOriginRequest("https://app.test/api/account/preferences/clear-recommendation-data", { method: "POST" }));

    // Then: the rejection remains private and generic.
    expect(response.status).toBe(500);
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
