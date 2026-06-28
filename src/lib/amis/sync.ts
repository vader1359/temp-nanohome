import "server-only";

import { createAmisClientConfig, fetchAmisVariants, type AmisVariantRecord } from "@/lib/amis/client";
import { env } from "@/lib/env";
import { createAmisSyncAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate, TypedSupabaseClient } from "@/types/db";

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

type SyncVariantsInput = {
  readonly supabase: TypedSupabaseClient;
  readonly logId: string;
  readonly records: readonly AmisVariantRecord[];
  readonly previousWatermark: string | null;
};

const AMIS_CREDENTIALS_MISSING_MESSAGE =
  "Missing AMIS credentials. Configure AMIS_API_BASE_URL, AMIS_CLIENT_ID, and AMIS_CLIENT_SECRET.";

export async function runAmisSync(): Promise<AmisSyncResult> {
  const supabase = createAmisSyncAdminClient();
  const logId = await createSyncLog(supabase);
  const watermark = await readWatermark(supabase);
  const config = createAmisClientConfig(env);

  if (config === null) {
    return finishSyncLog(supabase, logId, {
      status: "failed",
      items_processed: 0,
      items_failed: 0,
      error: AMIS_CREDENTIALS_MISSING_MESSAGE,
      watermark,
      finished_at: new Date().toISOString(),
    });
  }

  const fetchResult = await fetchAmisVariants(config, watermark);
  switch (fetchResult.kind) {
    case "http_error":
      return finishSyncLog(supabase, logId, {
        status: "partial",
        items_processed: 0,
        items_failed: 1,
        error: `AMIS HTTP ${fetchResult.status}: ${fetchResult.message}`,
        watermark,
        finished_at: new Date().toISOString(),
      });
    case "malformed":
      return finishSyncLog(supabase, logId, {
        status: "failed",
        items_processed: 0,
        items_failed: 1,
        error: `Malformed AMIS payload: ${fetchResult.message}`,
        watermark,
        finished_at: new Date().toISOString(),
      });
    case "success":
      return syncVariants({ supabase, logId, records: fetchResult.records, previousWatermark: watermark });
    default:
      return assertNever(fetchResult);
  }
}

async function createSyncLog(supabase: TypedSupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("amis_sync_log")
    .insert([{ status: "running", items_processed: 0, items_failed: 0, started_at: new Date().toISOString() }])
    .select("id")
    .single();

  if (error !== null) {
    throw error;
  }

  return data.id;
}

async function readWatermark(supabase: TypedSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("amis_sync_log")
    .select("watermark,started_at")
    .in("status", ["success", "partial"])
    .order("started_at", { ascending: false })
    .limit(1);

  if (error !== null) {
    throw error;
  }

  const [latest] = data ?? [];
  return latest?.watermark ?? latest?.started_at ?? null;
}

async function syncVariants(input: SyncVariantsInput): Promise<AmisSyncResult> {
  let itemsProcessed = 0;
  let itemsFailed = 0;
  let lastError: string | null = null;
  let watermark = input.previousWatermark;

  for (const record of input.records) {
    const update = toVariantUpdate(record);
    const { error } = await input.supabase.from("variants").update(update).eq("sku", record.sku);

    if (error === null) {
      itemsProcessed += 1;
      watermark = record.sourceUpdatedAt ?? watermark;
    } else {
      itemsFailed += 1;
      lastError = error.message;
    }
  }

  return finishSyncLog(input.supabase, input.logId, {
    status: statusFromCounts(itemsFailed),
    items_processed: itemsProcessed,
    items_failed: itemsFailed,
    error: lastError,
    watermark,
    finished_at: new Date().toISOString(),
  });
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

function statusFromCounts(itemsFailed: number): AmisSyncStatus {
  if (itemsFailed > 0) return "partial";
  return "success";
}

async function finishSyncLog(
  supabase: TypedSupabaseClient,
  logId: string,
  update: SyncLogUpdate,
): Promise<AmisSyncResult> {
  const { error } = await supabase.from("amis_sync_log").update(update).eq("id", logId);

  if (error !== null) {
    return {
      status: "partial",
      itemsProcessed: update.items_processed,
      itemsFailed: update.items_failed + 1,
      error: error.message,
      watermark: update.watermark,
    };
  }

  return {
    status: update.status,
    itemsProcessed: update.items_processed,
    itemsFailed: update.items_failed,
    error: update.error,
    watermark: update.watermark,
  };
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled AMIS fetch result: ${JSON.stringify(value)}`);
}
