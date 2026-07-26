import { describe, expect, it, vi } from "vitest";
import { AccountId, ServerSessionCookie } from "@/lib/account-session";
import {
  ProviderConfigurationNotInstalledError,
  createAuthSessionProvider,
  createCustomerMemoryProvider,
  createNotificationProvider,
  createPaymentProvider,
  createRecommendationProvider,
  createVisionProvider,
} from "./provider-composition.server";

const network = vi.fn(async () => new Response());

const expectNotInstalled = (create: () => unknown, provider: string): void => {
  expect(create).toThrowError(ProviderConfigurationNotInstalledError);
  expect(create).toThrowError(`Provider configuration is not installed: ${provider}`);
  expect(network).not.toHaveBeenCalled();
};

describe("safe provider composition", () => {
  it.each(["supabase", "disabled", "fake", "noop", "off"] as const)(
    "returns a network-free auth verifier for %s mode",
    async (mode) => {
      const loadFirebase = vi.fn();
      const verifier = createAuthSessionProvider({ mode, loadFirebase });

      await expect(verifier.verify(new ServerSessionCookie("secret"))).resolves.toBeNull();
      expect(loadFirebase).not.toHaveBeenCalled();
    },
  );

  it("loads the installed Firebase verifier only when verification is requested", async () => {
    const verify = vi.fn(async () => null);
    const loadFirebase = vi.fn(async () => ({ verify }));
    const verifier = createAuthSessionProvider({ mode: "firebase", loadFirebase });

    expect(loadFirebase).not.toHaveBeenCalled();
    await verifier.verify(new ServerSessionCookie("session"));
    expect(loadFirebase).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
  });

  it.each(["off", "disabled", "fake", "noop"] as const)(
    "returns a safe payment adapter for %s mode",
    async (mode) => {
      const gateway = createPaymentProvider({ mode });

      await expect(gateway.retrievePayment({ paymentId: "payment-1" })).resolves.toEqual({ kind: "unpaid" });
      expect(network).not.toHaveBeenCalled();
    },
  );

  it("fails closed for active SePay before network", () => {
    expectNotInstalled(() => createPaymentProvider({ mode: "sepay" }), "payment:sepay");
  });

  it("returns null from off customer memory without loading Supabase", async () => {
    const loadSupabase = vi.fn();
    const port = createCustomerMemoryProvider({ mode: "off", loadSupabase });

    await expect(port.getForAuthenticatedCustomer({ accountId: new AccountId("account-1"), purpose: "personalization" })).resolves.toBeNull();
    expect(loadSupabase).not.toHaveBeenCalled();
  });

  it("fails closed for active customer memory before loading Supabase", () => {
    const loadSupabase = vi.fn();
    expectNotInstalled(() => createCustomerMemoryProvider({ mode: "supabase", loadSupabase }), "customer-memory:supabase");
    expect(loadSupabase).not.toHaveBeenCalled();
  });

  it("uses a noop notification provider without network", async () => {
    const provider = createNotificationProvider({ mode: "noop" });

    await expect(provider.notify({ subject: "handoff", body: "ready" })).resolves.toEqual({ kind: "skipped" });
    expect(network).not.toHaveBeenCalled();
  });

  it("fails closed for active notification before network", () => {
    expectNotInstalled(() => createNotificationProvider({ mode: "active" }), "notification:active");
  });

  it.each(["off", "fake"] as const)("keeps vision %s mode network-free", async (mode) => {
    const provider = createVisionProvider({ mode });

    if (mode === "off") {
      await expect(provider.describeRoom("private/image")).rejects.toThrow("Vision is disabled.");
    } else {
      await expect(provider.describeRoom("private/image")).resolves.toMatchObject({ providerVersion: "v1" });
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("fails closed for active vision before network", () => {
    expectNotInstalled(() => createVisionProvider({ mode: "active" }), "vision:active");
  });

  it("returns a deterministic empty recommendation in shadow mode", async () => {
    const provider = createRecommendationProvider({ mode: "shadow" });

    await expect(provider.recommend({ placement: "home", contextVariantIds: [], locale: "en" })).resolves.toMatchObject({
      fallbackTier: "shadow",
      items: [],
      placement: "home",
    });
    expect(network).not.toHaveBeenCalled();
  });

  it("fails closed for active recommendations before network", () => {
    expectNotInstalled(() => createRecommendationProvider({ mode: "active" }), "recommendation:active");
  });
});
