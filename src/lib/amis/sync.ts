import "server-only";

import {
  createAmisClientConfig,
  fetchAmisStockLedger,
  fetchAmisVariants,
  type AmisClientConfig,
} from "@/lib/amis/client";
import { env } from "@/lib/env";
import { syncAmisPrices, type PriceSyncResult } from "@/lib/amis/price-sync";
import { syncAmisStockSnapshot, type StockSyncResult } from "@/lib/amis/stock-sync";
import { createAmisSyncAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/types/db";

export type AmisSyncStatus = "success" | "partial" | "failed";

export type AmisSyncResult = {
  readonly status: AmisSyncStatus;
  readonly itemsProcessed: number;
  readonly itemsFailed: number;
  readonly error: string | null;
  readonly watermark: string | null;
};

type SyncLogUpdate = {
  readonly status: AmisSyncStatus;
  readonly items_processed: number;
  readonly items_failed: number;
  readonly error: string | null;
  readonly watermark: string | null;
  readonly finished_at: string;
};

const AMIS_CREDENTIALS_MISSING_MESSAGE =
  "Missing AMIS credentials. Configure AMIS_API_BASE_URL, AMIS_CLIENT_ID, and AMIS_CLIENT_SECRET.";

export async function runAmisSync(): Promise<AmisSyncResult> {
  const supabase = createAmisSyncAdminClient();
  const logId = await createSyncLog(supabase);
  const watermark = await readWatermark(supabase);

  try {
    const config = createAmisClientConfig(env);
    if (config === null) return finishSyncLog(supabase, logId, failedUpdate(AMIS_CREDENTIALS_MISSING_MESSAGE, watermark, 0));

    const priceResult = await syncPriceDelta(supabase, config, watermark);
    const stockResult = await syncStockSnapshot(supabase, config);
    return finishSyncLog(supabase, logId, combinedUpdate(priceResult, stockResult));
  } catch (error) {
    return finishSyncLog(supabase, logId, failedUpdate(errorMessage(error), watermark, 1));
  }
}

async function syncPriceDelta(
  supabase: TypedSupabaseClient,
  config: AmisClientConfig,
  watermark: string | null,
): Promise<PriceSyncResult> {
  const fetchResult = await fetchAmisVariants(config, watermark);
  switch (fetchResult.kind) {
    case "success":
      return syncAmisPrices({ supabase, records: fetchResult.records, previousWatermark: watermark });
    case "http_error":
      return failedPriceResult("partial", `AMIS HTTP ${fetchResult.status}: ${fetchResult.message}`, watermark);
    case "malformed":
      return failedPriceResult("failed", `Malformed AMIS payload: ${fetchResult.message}`, watermark);
    default:
      return assertNever(fetchResult);
  }
}

function failedPriceResult(
  status: "partial" | "failed",
  error: string,
  watermark: string | null,
): PriceSyncResult {
  return { status, itemsProcessed: 0, itemsFailed: 1, error, watermark };
}

async function syncStockSnapshot(supabase: TypedSupabaseClient, config: AmisClientConfig): Promise<StockSyncResult> {
  const fetchResult = await fetchAmisStockLedger(config);
  switch (fetchResult.kind) {
    case "success":
      return syncAmisStockSnapshot({ supabase, records: fetchResult.records });
    case "http_error":
      return { itemsProcessed: 0, itemsFailed: 1, error: `AMIS stock HTTP ${fetchResult.status}: ${fetchResult.message}` };
    case "malformed":
      return { itemsProcessed: 0, itemsFailed: 1, error: `Malformed AMIS stock payload: ${fetchResult.message}` };
    default:
      return assertNever(fetchResult);
  }
}

async function createSyncLog(supabase: TypedSupabaseClient): Promise<string> {
  const { data, error } = await supabase.from("amis_sync_log")
    .insert([{ status: "running", items_processed: 0, items_failed: 0, started_at: new Date().toISOString() }])
    .select("id").single();
  if (error !== null) throw error;
  return data.id;
}

async function readWatermark(supabase: TypedSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from("amis_sync_log").select("watermark")
    .in("status", ["success", "partial"]).order("started_at", { ascending: false }).limit(1);
  if (error !== null) throw error;
  return data?.[0]?.watermark ?? null;
}

function combinedUpdate(price: PriceSyncResult, stock: StockSyncResult): SyncLogUpdate {
  const itemsFailed = price.itemsFailed + stock.itemsFailed;
  return {
    status: price.status === "failed" ? "failed" : statusFromCounts(itemsFailed),
    items_processed: price.itemsProcessed + stock.itemsProcessed,
    items_failed: itemsFailed,
    error: stock.error ?? price.error,
    watermark: price.watermark,
    finished_at: new Date().toISOString(),
  };
}

function failedUpdate(error: string, watermark: string | null, itemsFailed = 1): SyncLogUpdate {
  return { status: "failed", items_processed: 0, items_failed: itemsFailed, error, watermark, finished_at: new Date().toISOString() };
}

function statusFromCounts(itemsFailed: number): AmisSyncStatus {
  return itemsFailed > 0 ? "partial" : "success";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "Unexpected AMIS sync failure";
}

async function finishSyncLog(supabase: TypedSupabaseClient, logId: string, update: SyncLogUpdate): Promise<AmisSyncResult> {
  const { error } = await supabase.from("amis_sync_log").update(update).eq("id", logId);
  if (error !== null) {
    return { status: "partial", itemsProcessed: update.items_processed, itemsFailed: update.items_failed + 1, error: error.message, watermark: update.watermark };
  }
  return { status: update.status, itemsProcessed: update.items_processed, itemsFailed: update.items_failed, error: update.error, watermark: update.watermark };
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled AMIS fetch result: ${JSON.stringify(value)}`);
}
