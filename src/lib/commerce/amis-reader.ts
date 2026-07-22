import { createHash } from "node:crypto";
import { z } from "zod";

import { parseRawSku, type RawSku } from "@/lib/commerce/domain";

const pageSchema = z.object({
  total_pages: z.number().int().positive(),
  data: z.array(z.object({
    product_code: z.string().min(1),
    warehouse_id: z.string().min(1),
    warehouse_name: z.string().min(1),
    amount_summary: z.number().finite(),
    observed_at: z.string().datetime({ offset: true }),
  })),
});

export type AmisStockPageFetcher = (page: number) => Promise<unknown>;

export type AmisStockRecord = {
  readonly sku: string;
  readonly warehouseId: string;
  readonly warehouseName: string;
  readonly stock: number;
  readonly observedAt: string;
};

export type AmisStockLedger = {
  readonly records: readonly AmisStockRecord[];
  readonly digest: string;
};

export type StockReadResult =
  | { readonly kind: "success"; readonly ledger: AmisStockLedger; readonly records: readonly AmisStockRecord[] }
  | { readonly kind: "malformed"; readonly message: string };

export type StockRequest = {
  readonly sku: RawSku;
  readonly warehouseId: string;
  readonly warehouseName: string;
  readonly quantity: number;
};

export type StockAssessment =
  | { readonly kind: "available"; readonly observed: number; readonly digest: string }
  | { readonly kind: "unavailable"; readonly reason: "missing" | "duplicate" | "stale" | "insufficient" | "invalid_request" };

export async function readAmisStockLedger(input: { readonly fetchPage: AmisStockPageFetcher }): Promise<StockReadResult> {
  const records: AmisStockRecord[] = [];
  let totalPages: number | undefined;
  for (let page = 1; totalPages === undefined || page <= totalPages; page += 1) {
    const parsed = pageSchema.safeParse(await input.fetchPage(page));
    if (!parsed.success) return { kind: "malformed", message: parsed.error.message };
    totalPages = totalPages ?? parsed.data.total_pages;
    if (parsed.data.total_pages !== totalPages) return { kind: "malformed", message: "AMIS page count changed during read" };
    try {
      records.push(...parsed.data.data.map((record) => ({
        sku: parseRawSku(record.product_code),
        warehouseId: record.warehouse_id,
        warehouseName: record.warehouse_name,
        stock: record.amount_summary,
        observedAt: record.observed_at,
      })));
    } catch (error) {
      if (error instanceof Error) return { kind: "malformed", message: error.message };
      throw error;
    }
  }
  const ledger = { records, digest: digestRecords(records) } satisfies AmisStockLedger;
  return { kind: "success", ledger, records };
}

export async function assessAmisStock(input: {
  readonly ledger: StockReadResult;
  readonly requested: StockRequest;
  readonly now: string;
  readonly maxAgeMs: number;
}): Promise<StockAssessment> {
  if (input.ledger.kind !== "success" || input.requested.quantity <= 0 || !Number.isFinite(input.requested.quantity)) {
    return { kind: "unavailable", reason: input.ledger.kind === "success" ? "invalid_request" : "missing" };
  }
  const identityMatches = input.ledger.records.filter((record) => record.sku === input.requested.sku
    && record.warehouseId === input.requested.warehouseId);
  if (identityMatches.length === 0) return { kind: "unavailable", reason: "missing" };
  if (identityMatches.length !== 1) return { kind: "unavailable", reason: "duplicate" };
  const record = identityMatches[0];
  if (record === undefined || Date.parse(input.now) - Date.parse(record.observedAt) > input.maxAgeMs) {
    return { kind: "unavailable", reason: "stale" };
  }
  if (record.stock < input.requested.quantity) return { kind: "unavailable", reason: "insufficient" };
  return { kind: "available", observed: record.stock, digest: input.ledger.ledger.digest };
}

function digestRecords(records: readonly AmisStockRecord[]): string {
  const canonical = [...records]
    .sort((left, right) => {
      const leftValue = `${left.sku}\u0000${left.warehouseId}\u0000${left.warehouseName}\u0000${left.stock}\u0000${left.observedAt}`;
      const rightValue = `${right.sku}\u0000${right.warehouseId}\u0000${right.warehouseName}\u0000${right.stock}\u0000${right.observedAt}`;
      return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    })
    .map((record) => `${record.sku}\u0000${record.warehouseId}\u0000${record.warehouseName}\u0000${record.stock}\u0000${record.observedAt}`)
    .join("\u0001");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
