import { describe, expect, it, vi } from "vitest";
import { loadPlan07CustomerFeatures } from "./customer-runtime";

const options = {
  userId: "11111111-1111-4111-8111-111111111111",
  visitorId: "22222222-2222-4222-8222-222222222222",
  baseUrl: "https://supabase.test",
  serviceRoleKey: "service-key",
};

describe("Plan 07 customer feature loader", () => {
  it("loads consent-filtered views only after the visitor is bound to the current account", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/customer_identity_ledger")) {
        return new Response(JSON.stringify([{
          user_id: options.userId,
          identity_kind: "authenticated",
        }]), { status: 200 });
      }
      if (url.pathname.endsWith("/customer_preferences_active")) {
        return new Response(JSON.stringify([{
          feature_type: "material_tag",
          feature_key: "material",
          feature_value: "linen",
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{
        entity_type: "variant",
        entity_id: "33333333-3333-4333-8333-333333333333",
      }]), { status: 200 });
    });

    await expect(loadPlan07CustomerFeatures({ ...options, fetcher })).resolves.toEqual({
      preferences: [{ key: "material", value: "linen", labelKey: "material_tag" }],
      recent: [{
        entityType: "variant",
        entityId: "33333333-3333-4333-8333-333333333333",
      }],
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get("order")).toBe("recorded_at.desc,id.desc");
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ cache: "no-store" });
    }
  });

  it("returns no visitor data when the latest account binding does not match", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{
      user_id: "44444444-4444-4444-8444-444444444444",
      identity_kind: "authenticated",
    }]), { status: 200 }));

    await expect(loadPlan07CustomerFeatures({ ...options, fetcher })).resolves.toEqual({
      preferences: [],
      recent: [],
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("fails closed when the safe projection is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", {
      status: 503,
    }));

    await expect(loadPlan07CustomerFeatures({ ...options, fetcher })).resolves.toEqual({
      preferences: [],
      recent: [],
    });
  });

  it("rejects a product slug or SKU where the UUID catalog entity ID is required", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/customer_identity_ledger")) {
        return new Response(JSON.stringify([{
          user_id: options.userId,
          identity_kind: "authenticated",
        }]), { status: 200 });
      }
      if (url.pathname.endsWith("/customer_preferences_active")) {
        return new Response("[]", { status: 200 });
      }
      return new Response(JSON.stringify([{
        entity_type: "variant",
        entity_id: "clgbb00001",
      }]), { status: 200 });
    });

    await expect(loadPlan07CustomerFeatures({ ...options, fetcher })).resolves.toEqual({
      preferences: [],
      recent: [],
    });
  });
});
