import { z } from "zod";

import type { AmisClientConfig } from "@/lib/amis/client";
import { requestAccessToken } from "@/lib/amis/client";
import { numericValueSchema } from "@/lib/amis/schemas";
import { amisReadOnlyFetch } from "@/lib/remote-read-only";

const AMIS_SALE_ORDER_PAGE_SIZE = 100;

export type AmisSaleOrderMapping = {
  readonly id: number;
  readonly productCode: string | null;
  readonly amount: number | null;
  readonly producedQuantity: number | null;
  readonly totalAmountDelivered: number | null;
  readonly isNoteRow: boolean;
};

export type AmisSaleOrder = {
  readonly id: number;
  readonly modifiedDate: string;
  readonly approvedStatus: string | null;
  readonly approvedDate: string | null;
  readonly status: string | null;
  readonly isDeleted: boolean;
  readonly mappings: readonly AmisSaleOrderMapping[];
};

export type FetchAmisSaleOrdersResult =
  | { readonly kind: "success"; readonly records: readonly AmisSaleOrder[] }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

export async function fetchAmisSaleOrders(
  config: AmisClientConfig,
  watermark: string | null,
): Promise<FetchAmisSaleOrdersResult> {
  const token = await requestAccessToken(config);
  if (token.kind !== "success") return token;

  const records: AmisSaleOrder[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchSaleOrderPage(config, token.token, page);
    if (result.kind !== "success") return result;
    records.push(...result.records.filter((record) => isAtOrAfterWatermark(record.modifiedDate, watermark)));
    if (result.records.length < AMIS_SALE_ORDER_PAGE_SIZE || reachedBeforeWatermark(result.records, watermark)) {
      return { kind: "success", records };
    }
  }
}

type SaleOrderPageResult = Exclude<FetchAmisSaleOrdersResult, { readonly kind: "success" }> | {
  readonly kind: "success";
  readonly records: readonly AmisSaleOrder[];
};

async function fetchSaleOrderPage(config: AmisClientConfig, token: string, page: number): Promise<SaleOrderPageResult> {
  const url = new URL("/api/v2/SaleOrders", config.baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(AMIS_SALE_ORDER_PAGE_SIZE));
  url.searchParams.set("orderBy", "modified_date");
  url.searchParams.set("isDescending", "true");
  const response = await amisReadOnlyFetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, Clientid: config.clientId },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { kind: "http_error", status: response.status, message: "AMIS Sale Order read failed" };
  const parsed = saleOrdersResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { kind: "malformed", message: "AMIS Sale Order payload is malformed" };
  if (!parsed.data.success || parsed.data.code !== 200) {
    return { kind: "http_error", status: parsed.data.code, message: "AMIS rejected the Sale Order read request" };
  }
  return { kind: "success", records: parsed.data.data.map(toSaleOrder) };
}

function isAtOrAfterWatermark(modifiedDate: string, watermark: string | null): boolean {
  return watermark === null || Date.parse(modifiedDate) >= Date.parse(watermark);
}

function reachedBeforeWatermark(records: readonly AmisSaleOrder[], watermark: string | null): boolean {
  return watermark !== null && records.some((record) => Date.parse(record.modifiedDate) < Date.parse(watermark));
}

const saleOrderMappingSchema = z.object({
  id: z.number().int(),
  product_code: z.string().nullable().optional(),
  amount: numericValueSchema.nullable().optional(),
  produced_quantity: numericValueSchema.nullable().optional(),
  total_amount_delivered: numericValueSchema.nullable().optional(),
  is_note_row: z.boolean(),
});

const saleOrderSchema = z.object({
  id: z.number().int(),
  modified_date: z.string().datetime({ offset: true }),
  approved_status: z.string().nullable().optional(),
  approved_date: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.string().nullable().optional(),
  is_deleted: z.boolean(),
  sale_order_product_mappings: z.array(saleOrderMappingSchema),
});

const saleOrdersResponseSchema = z.object({ success: z.boolean(), code: z.number().int(), data: z.array(saleOrderSchema) });
type ParsedSaleOrder = z.infer<typeof saleOrderSchema>;

function toSaleOrder(order: ParsedSaleOrder): AmisSaleOrder {
  return {
    id: order.id, modifiedDate: order.modified_date, approvedStatus: order.approved_status ?? null,
    approvedDate: order.approved_date ?? null, status: order.status ?? null, isDeleted: order.is_deleted,
    mappings: order.sale_order_product_mappings.map((mapping) => ({
      id: mapping.id, productCode: mapping.product_code ?? null, amount: mapping.amount ?? null,
      producedQuantity: mapping.produced_quantity ?? null, totalAmountDelivered: mapping.total_amount_delivered ?? null,
      isNoteRow: mapping.is_note_row,
    })),
  };
}
