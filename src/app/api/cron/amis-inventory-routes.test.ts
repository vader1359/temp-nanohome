import { afterEach, describe, expect, it, vi } from "vitest";

import type { InventorySyncResult } from "@/lib/amis/inventory-sync";

const runBaseline = vi.hoisted(() => vi.fn<() => Promise<InventorySyncResult>>(async () => ({ status: "success", itemsProcessed: 0, error: null })));
const runSaleOrders = vi.hoisted(() => vi.fn<() => Promise<InventorySyncResult>>(async () => ({ status: "success", itemsProcessed: 0, error: null })));

vi.mock("@/lib/amis/inventory-sync", () => ({ runAmisInventoryBaseline: runBaseline, runAmisSaleOrderDelta: runSaleOrders }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  runBaseline.mockClear();
  runSaleOrders.mockClear();
});

describe("AMIS inventory cron routes", () => {
  it("authenticates the baseline route and invokes only the physical snapshot feed", async () => {
    // Given: a valid cron secret and baseline route module.
    vi.stubEnv("CRON_SECRET", "cron-test");
    const { POST } = await import("./amis-stock-baseline/route");

    // When: a valid cron request invokes the baseline route.
    const response = await POST(request("/api/cron/amis-stock-baseline", "cron-test"));

    // Then: only the baseline job executes.
    expect(response.status).toBe(200);
    expect(runBaseline).toHaveBeenCalledOnce();
    expect(runSaleOrders).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized Sale Order route request before invoking either feed", async () => {
    // Given: a configured secret and Sale Order route module.
    vi.stubEnv("CRON_SECRET", "cron-test");
    const { POST } = await import("./amis-sale-orders/route");

    // When: an invalid bearer token reaches the route.
    const response = await POST(request("/api/cron/amis-sale-orders", "wrong"));

    // Then: authentication stops both inventory feeds.
    expect(response.status).toBe(401);
    expect(runBaseline).not.toHaveBeenCalled();
    expect(runSaleOrders).not.toHaveBeenCalled();
  });

  it("invokes only the Sale Order delta feed after authorization", async () => {
    // Given: a valid cron secret and Sale Order route module.
    vi.stubEnv("CRON_SECRET", "cron-test");
    const { POST } = await import("./amis-sale-orders/route");

    // When: a valid cron request invokes the delta route.
    const response = await POST(request("/api/cron/amis-sale-orders", "cron-test"));

    // Then: no baseline or price work runs through this route.
    expect(response.status).toBe(200);
    expect(runBaseline).not.toHaveBeenCalled();
    expect(runSaleOrders).toHaveBeenCalledOnce();
  });

  it("does not expose internal inventory failures from the baseline route", async () => {
    // Given: the baseline service fails with sensitive upstream content.
    vi.stubEnv("CRON_SECRET", "cron-test");
    runBaseline.mockResolvedValueOnce({ status: "failed", itemsProcessed: 0, error: "sensitive-order-data" });
    const { POST } = await import("./amis-stock-baseline/route");

    // When: an authorized cron request receives the failure response.
    const response = await POST(request("/api/cron/amis-stock-baseline", "cron-test"));
    const body = await response.json();

    // Then: the route reports a stable public message without upstream content.
    expect(body).toEqual({ status: "failed", itemsProcessed: 0, error: "AMIS inventory sync failed" });
    expect(JSON.stringify(body)).not.toContain("sensitive-order-data");
  });
});

function request(pathname: string, secret: string): Request {
  return new Request(`https://app.test${pathname}`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
}
