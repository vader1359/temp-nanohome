import { afterEach, describe, expect, it, vi } from "vitest";

import { type AmisClientConfig } from "@/lib/amis/client";
import { fetchAmisSaleOrders } from "@/lib/amis/sale-order-client";

const config: AmisClientConfig = {
  baseUrl: "https://crmconnect.misa.vn",
  clientId: "nanohome",
  clientSecret: "amis-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAmisSaleOrders", () => {
  it("pages newest-first through the inclusive watermark tie and parses order lines", async () => {
    // Given: AMIS has a page at the stored watermark and an older page beyond it.
    const requestedPages: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      requestedPages.push(url.searchParams.get("page") ?? "");
      expect(url.searchParams.get("orderBy")).toBe("modified_date");
      expect(url.searchParams.get("isDescending")).toBe("true");
      if (url.searchParams.get("page") === "1") {
        return Response.json({ success: true, code: 200, data: [
          ...Array.from({ length: 99 }, (_, index) => saleOrder(index + 2, "2026-07-10T03:00:00.000Z")),
          saleOrder(1, "2026-07-10T02:00:00.000Z"),
        ] });
      }
      return Response.json({ success: true, code: 200, data: [saleOrder(0, "2026-07-10T01:00:00.000Z")] });
    }));

    // When: the delta reader resumes from the watermark.
    const result = await fetchAmisSaleOrders(config, "2026-07-10T02:00:00.000Z");

    // Then: the equal watermark order is replayed and older records stop pagination.
    expect(result).toEqual({ kind: "success", records: expect.arrayContaining([
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: 1 }),
    ]) });
    expect(requestedPages).toEqual(["1", "2"]);
  });

  it("collects every current record from a full page that also contains older records", async () => {
    // Given: page one contains both a watermark tie and an older record.
    const requestedPages: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      requestedPages.push(url.searchParams.get("page") ?? "");
      return Response.json({ success: true, code: 200, data: [
        ...Array.from({ length: 99 }, (_, index) => saleOrder(index + 2, "2026-07-10T03:00:00.000Z")),
        saleOrder(1, "2026-07-10T01:00:00.000Z"),
      ] });
    }));

    // When: the reader reaches the first older record in a full page.
    const result = await fetchAmisSaleOrders(config, "2026-07-10T02:00:00.000Z");

    // Then: all newer records from that page are retained and no further page is requested.
    expect(result).toEqual({ kind: "success", records: expect.arrayContaining([expect.objectContaining({ id: 2 })]) });
    expect(result.kind === "success" ? result.records : []).toHaveLength(99);
    expect(requestedPages).toEqual(["1"]);
  });

  it("fails the complete fetch when a Sale Order mapping is malformed", async () => {
    // Given: AMIS returns an order whose mapping omits its stable ID.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      return Response.json({ success: true, code: 200, data: [{ ...saleOrder(1, "2026-07-10T03:00:00.000Z"), sale_order_product_mappings: [{}] }] });
    }));

    // When: the reader parses the response.
    const result = await fetchAmisSaleOrders(config, null);

    // Then: the partial order cannot make persisted reservations look cancelled.
    expect(result).toEqual({ kind: "malformed", message: "AMIS Sale Order payload is malformed" });
  });

  it("does not expose a failed AMIS response body", async () => {
    // Given: AMIS rejects a Sale Order read with sensitive response content.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v2/Account") return Response.json({ success: true, code: 0, data: "token" });
      return new Response("sensitive-order-data", { status: 502 });
    }));

    // When: the reader receives the failed AMIS response.
    const result = await fetchAmisSaleOrders(config, null);

    // Then: callers receive only the fixed failure classification.
    expect(result).toEqual({ kind: "http_error", status: 502, message: "AMIS Sale Order read failed" });
  });
});

function saleOrder(id: number, modifiedDate: string) {
  return {
    id,
    modified_date: modifiedDate,
    approved_status: "Đã duyệt",
    approved_date: "2026-07-10T02:00:00.000Z",
    status: "approved",
    is_deleted: false,
    sale_order_product_mappings: [{ id: id * 10, product_code: "SKU-1", amount: 2, produced_quantity: null, total_amount_delivered: 0, is_note_row: false }],
  };
}
