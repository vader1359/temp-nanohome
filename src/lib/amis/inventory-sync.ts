import "server-only";

import { z } from "zod";

import { createAmisClientConfig, fetchAmisStockLedger } from "@/lib/amis/client";
import { fetchAmisSaleOrders, type AmisSaleOrder } from "@/lib/amis/sale-order-client";
import { env } from "@/lib/env";
import { createAmisSyncAdminClient } from "@/lib/supabase/admin";
import type { Json, TypedSupabaseClient } from "@/types/db";

const INVENTORY_SYNC_KEY = "inventory";
const rpcResultSchema = z.object({ items_processed: z.number().int().nonnegative() });
const INVENTORY_STATE_FAILURE = "AMIS inventory state read failed";
const INVENTORY_PERSISTENCE_FAILURE = "AMIS inventory persistence failed";
const STOCK_READ_FAILURE = "AMIS stock read failed";
const SALE_ORDER_READ_FAILURE = "AMIS Sale Order read failed";

export type InventorySyncResult = { readonly status: "success" | "failed"; readonly itemsProcessed: number; readonly error: string | null };

export async function runAmisInventoryBaseline(): Promise<InventorySyncResult> {
  const supabase = createAmisSyncAdminClient();
  const { data: state, error } = await supabase.from("amis_inventory_sync_state")
    .select("active_baseline_id").eq("sync_key", INVENTORY_SYNC_KEY).maybeSingle();
  if (error !== null) return failed(INVENTORY_STATE_FAILURE);
  const config = createAmisClientConfig(env);
  if (config === null) return failed("Missing AMIS credentials.");
  const ledger = await fetchAmisStockLedger(config);
  if (ledger.kind !== "success") return failed(STOCK_READ_FAILURE);
  const completedAt = new Date().toISOString();
  return applyInventorySync(supabase, {
    p_mode: "baseline",
    p_completed_at: completedAt,
    p_baseline_lines: ledger.records.map((record) => ({ sku: record.sku, stock: record.stock })),
    p_orders: [],
    p_order_lines: [],
    p_watermark: null,
    p_expected_baseline_id: state?.active_baseline_id ?? null,
    p_expected_watermark: null,
  });
}

export async function runAmisSaleOrderDelta(): Promise<InventorySyncResult> {
  const supabase = createAmisSyncAdminClient();
  const { data: state, error } = await supabase.from("amis_inventory_sync_state")
    .select("active_baseline_id, sale_order_watermark").eq("sync_key", INVENTORY_SYNC_KEY).maybeSingle();
  if (error !== null) return failed(INVENTORY_STATE_FAILURE);
  if (state?.active_baseline_id === null || state?.active_baseline_id === undefined) return failed("No active AMIS inventory baseline.");
  const config = createAmisClientConfig(env);
  if (config === null) return failed("Missing AMIS credentials.");
  const orders = await fetchAmisSaleOrders(config, state.sale_order_watermark);
  if (orders.kind !== "success") return failed(SALE_ORDER_READ_FAILURE);
  return applyInventorySync(supabase, {
    p_mode: "sale_orders",
    p_completed_at: new Date().toISOString(),
    p_baseline_lines: [],
    p_orders: orders.records.map(toPersistedOrder),
    p_order_lines: orders.records.flatMap(toPersistedLines),
    p_watermark: latestWatermark(state.sale_order_watermark, orders.records.map((order) => order.modifiedDate)),
    p_expected_baseline_id: state.active_baseline_id,
    p_expected_watermark: state.sale_order_watermark,
  });
}

type InventorySyncRpcArgs = {
  readonly p_mode: string;
  readonly p_completed_at: string;
  readonly p_baseline_lines: Json;
  readonly p_orders: Json;
  readonly p_order_lines: Json;
  readonly p_watermark: string | null;
  readonly p_expected_baseline_id: string | null;
  readonly p_expected_watermark: string | null;
};

async function applyInventorySync(supabase: TypedSupabaseClient, args: InventorySyncRpcArgs): Promise<InventorySyncResult> {
  const { data, error } = await supabase.rpc("apply_amis_inventory_sync", args);
  if (error !== null) return failed(INVENTORY_PERSISTENCE_FAILURE);
  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) return failed("AMIS inventory sync returned an invalid result");
  return { status: "success", itemsProcessed: parsed.data.items_processed, error: null };
}

function toPersistedOrder(order: AmisSaleOrder) {
  return {
    amis_order_id: order.id,
    modified_date: order.modifiedDate,
    approved_status: order.approvedStatus,
    approved_date: order.approvedDate,
    status: order.status,
    is_deleted: order.isDeleted,
  };
}

function toPersistedLines(order: AmisSaleOrder) {
  return order.mappings.map((line) => ({
    amis_line_id: line.id,
    amis_order_id: order.id,
    sku: line.productCode,
    amount: line.amount,
    produced_quantity: line.producedQuantity,
    total_amount_delivered: line.totalAmountDelivered,
    is_note_row: line.isNoteRow,
  }));
}

function latestWatermark(current: string | null, dates: readonly string[]): string | null {
  return dates.reduce((latest, date) => latest === null || Date.parse(date) > Date.parse(latest) ? date : latest, current);
}

function failed(error: string): InventorySyncResult {
  return { status: "failed", itemsProcessed: 0, error };
}
