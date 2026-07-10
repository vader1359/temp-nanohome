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
const VARIANT_WRITE_CONCURRENCY = 10;

export async function runAmisSync(): Promise<AmisSyncResult> {
  const supabase = createAmisSyncAdminClient();
  const logId = await createSyncLog(supabase);
  const watermark = await readWatermark(supabase);

  try {
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
        return syncVariants({
          supabase,
          logId,
          records: fetchResult.records,
          previousWatermark: watermark,
        });
      default:
        return assertNever(fetchResult);
    }
  } catch (error) {
    return finishSyncLog(supabase, logId, {
      status: "failed",
      items_processed: 0,
      items_failed: 1,
      error: errorMessage(error),
      watermark,
      finished_at: new Date().toISOString(),
    });
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
    .select("watermark")
    .in("status", ["success", "partial"])
    .order("started_at", { ascending: false })
    .limit(1);

  if (error !== null) {
    throw error;
  }

  const [latest] = data ?? [];
  return latest?.watermark ?? null;
}

async function syncVariants(input: SyncVariantsInput): Promise<AmisSyncResult> {
  let itemsProcessed = 0;
  let itemsFailed = 0;
  let lastError: string | null = null;
  let completedWatermark = input.previousWatermark;

  for (let start = 0; start < input.records.length; start += VARIANT_WRITE_CONCURRENCY) {
    const records = input.records.slice(start, start + VARIANT_WRITE_CONCURRENCY);
    const results = await Promise.all(
      records.map(async (record) => ({
        record,
        result: await input.supabase
          .from("variants")
          .update(toVariantUpdate(record), { count: "exact" })
          .eq("sku", record.sku),
      })),
    );

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

  return finishSyncLog(input.supabase, input.logId, {
    status: statusFromCounts(itemsFailed),
    items_processed: itemsProcessed,
    items_failed: itemsFailed,
    error: lastError,
    watermark: itemsFailed === 0 ? completedWatermark : input.previousWatermark,
    finished_at: new Date().toISOString(),
  });
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

function statusFromCounts(itemsFailed: number): AmisSyncStatus {
  if (itemsFailed > 0) return "partial";
  return "success";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Unexpected AMIS sync failure";
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
