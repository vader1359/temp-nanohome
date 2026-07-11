import { describe, expect, it } from "vitest";

import { availableStockBySku } from "@/lib/amis/availability";

describe("availableStockBySku", () => {
  it("subtracts only approved non-deleted non-note lines after the baseline", () => {
    // Given: a baseline and order state including invalid, cancelled, and duplicate-SKU rows.
    const baseline = [{ sku: "SKU-1", stock: 8 }, { sku: "SKU-2", stock: 3 }];
    const lines = [
      { orderId: 1, lineId: 10, sku: "SKU-1", amount: 3, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: false, approvedAt: "2026-07-10T02:00:01.000Z" },
      { orderId: 2, lineId: 20, sku: "SKU-1", amount: 9, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: true, approvedAt: "2026-07-10T02:00:00.000Z" },
      { orderId: 3, lineId: 30, sku: "SKU-2", amount: 1, isNoteRow: true, approvedStatus: "Đã duyệt", isDeleted: false, approvedAt: "2026-07-10T02:00:00.000Z" },
      { orderId: 4, lineId: 40, sku: "SKU-2", amount: 5, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: false, approvedAt: "2026-07-10T01:59:59.000Z" },
      { orderId: 5, lineId: 50, sku: "SKU-1", amount: 8, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: false, approvedAt: "2026-07-10T02:00:00.000Z" },
    ];

    // When: availability is derived from persisted source state.
    const availability = availableStockBySku({ baselineCompletedAt: "2026-07-10T02:00:00.000Z", baseline, lines });

    // Then: only orders created after the completed snapshot reduce stock.
    expect(availability).toEqual(new Map([["SKU-1", 5], ["SKU-2", 3]]));
  });

  it("recalculates availability from amended and removed persisted source lines", () => {
    // Given: the current source state supersedes a previous quantity and marks a removed line deleted.
    const baseline = [{ sku: "SKU-1", stock: 10 }];
    const lines = [
      { orderId: 1, lineId: 10, sku: "SKU-1", amount: 4, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: false, approvedAt: "2026-07-10T02:00:00.000Z" },
      { orderId: 2, lineId: 20, sku: "SKU-1", amount: 3, isNoteRow: false, approvedStatus: "Đã duyệt", isDeleted: true, approvedAt: "2026-07-10T02:00:00.000Z" },
    ];

    // When: the projection is rebuilt from the persisted current line state.
    const availability = availableStockBySku({ baselineCompletedAt: "2026-07-10T02:00:00.000Z", baseline, lines });

    // Then: the amended amount is reserved once and the deleted source line is reversed.
    expect(availability).toEqual(new Map([["SKU-1", 10]]));
  });
});
