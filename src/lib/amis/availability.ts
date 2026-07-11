export type InventoryBaselineLine = {
  readonly sku: string;
  readonly stock: number;
};

export type InventorySaleOrderLine = {
  readonly orderId: number;
  readonly lineId: number;
  readonly sku: string | null;
  readonly amount: number | null;
  readonly isNoteRow: boolean;
  readonly approvedStatus: string | null;
  readonly isDeleted: boolean;
  readonly approvedAt: string | null;
};

type AvailabilityInput = {
  readonly baselineCompletedAt: string;
  readonly baseline: readonly InventoryBaselineLine[];
  readonly lines: readonly InventorySaleOrderLine[];
};

const APPROVED_STATUS = "Đã duyệt";

export function availableStockBySku(input: AvailabilityInput): ReadonlyMap<string, number> {
  const available = new Map(input.baseline.map((line) => [line.sku, line.stock]));

  for (const line of input.lines) {
    if (!reservesStock(line, input.baselineCompletedAt) || line.sku === null || line.amount === null) continue;
    const current = available.get(line.sku);
    if (current !== undefined) available.set(line.sku, current - line.amount);
  }

  return available;
}

function reservesStock(line: InventorySaleOrderLine, baselineCompletedAt: string): boolean {
  return line.approvedStatus === APPROVED_STATUS
    && !line.isDeleted
    && !line.isNoteRow
    && line.sku !== null
    && line.sku.length > 0
    && line.amount !== null
    && Number.isFinite(line.amount)
    && line.approvedAt !== null
    && Date.parse(line.approvedAt) > Date.parse(baselineCompletedAt);
}
