import type { AmisVariantRecord } from "@/lib/amis/client";
import type { TablesUpdate, TypedSupabaseClient } from "@/types/db";

const VARIANT_WRITE_CONCURRENCY = 10;

type PriceSyncInput = {
  readonly supabase: TypedSupabaseClient;
  readonly records: readonly AmisVariantRecord[];
  readonly previousWatermark: string | null;
};

export type PriceSyncResult = {
  readonly status: "success" | "partial" | "failed";
  readonly itemsProcessed: number;
  readonly itemsFailed: number;
  readonly error: string | null;
  readonly watermark: string | null;
};

export async function syncAmisPrices(input: PriceSyncInput): Promise<PriceSyncResult> {
  let itemsProcessed = 0;
  let itemsFailed = 0;
  let lastError: string | null = null;
  let completedWatermark = input.previousWatermark;

  for (let start = 0; start < input.records.length; start += VARIANT_WRITE_CONCURRENCY) {
    const records = input.records.slice(start, start + VARIANT_WRITE_CONCURRENCY);
    const results = await Promise.all(records.map(async (record) => ({
      record,
      result: await input.supabase.from("variants")
        .update(toVariantUpdate(record), { count: "exact" })
        .eq("sku", record.sku),
    })));

    for (const { record, result } of results) {
      if (result.error !== null) {
        itemsFailed += 1;
        lastError = result.error.message;
      } else if (result.count === 0) {
        itemsFailed += 1;
        lastError = `No Supabase variant matched AMIS SKU ${record.sku}`;
      } else {
        itemsProcessed += 1;
        completedWatermark = latestWatermark(completedWatermark, record.sourceUpdatedAt);
      }
    }
  }

  return {
    status: itemsFailed > 0 ? "partial" : "success",
    itemsProcessed,
    itemsFailed,
    error: lastError,
    watermark: itemsFailed === 0 ? completedWatermark : input.previousWatermark,
  };
}

function latestWatermark(current: string | null, candidate: string | null | undefined): string | null {
  if (candidate === null || candidate === undefined) return current;
  if (current === null || Date.parse(candidate) > Date.parse(current)) return candidate;
  return current;
}

function toVariantUpdate(record: AmisVariantRecord): TablesUpdate<"variants"> {
  const update: TablesUpdate<"variants"> = {};
  if (record.price !== undefined) update.price = record.price;
  if (record.compareAtPrice !== undefined) update.compare_at_price = record.compareAtPrice;
  if (record.discountPercent !== undefined) update.discount_percent = record.discountPercent;
  if (record.inStock !== undefined) update.in_stock = record.inStock;
  if (record.sourceUpdatedAt !== undefined) update.source_updated_at = record.sourceUpdatedAt;
  return update;
}
