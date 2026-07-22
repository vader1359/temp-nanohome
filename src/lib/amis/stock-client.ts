import { z } from "zod";

import {
  type AmisClientConfig,
  requestAccessToken,
} from "@/lib/amis/client";
import { numericValueSchema } from "@/lib/amis/schemas";
import { amisReadOnlyFetch } from "@/lib/remote-read-only";

const AMIS_STOCK_LEDGER_PAGE_SIZE = 50;

export type AmisStockLedgerRecord = {
  readonly sku: string;
  readonly stock: number;
};

export type FetchAmisStockLedgerResult =
  | { readonly kind: "success"; readonly records: readonly AmisStockLedgerRecord[] }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

type FetchAmisStockLedgerPageResult =
  | { readonly kind: "success"; readonly records: readonly AmisStockLedgerRecord[]; readonly totalPages: number }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

export async function fetchAmisStockLedger(config: AmisClientConfig): Promise<FetchAmisStockLedgerResult> {
  const accessToken = await requestAccessToken(config);
  if (accessToken.kind !== "success") return accessToken;

  const firstPage = await fetchAmisStockLedgerPage(config, accessToken.token, 1);
  if (firstPage.kind !== "success") return firstPage;

  const records = [...firstPage.records];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const pageResult = await fetchAmisStockLedgerPage(config, accessToken.token, page);
    if (pageResult.kind !== "success") return pageResult;
    records.push(...pageResult.records);
  }

  return { kind: "success", records: uniqueStockLedgerRecords(records) };
}

async function fetchAmisStockLedgerPage(
  config: AmisClientConfig,
  accessToken: string,
  page: number,
): Promise<FetchAmisStockLedgerPageResult> {
  const url = new URL("/api/v2/Stocks/product_ledger", config.baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(AMIS_STOCK_LEDGER_PAGE_SIZE));

  const response = await amisReadOnlyFetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, Clientid: config.clientId },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { kind: "http_error", status: response.status, message: await response.text() };

  const parsed = amisStockLedgerResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { kind: "malformed", message: parsed.error.message };
  if (parsed.data.code !== 0) {
    return {
      kind: "http_error",
      status: parsed.data.code,
      message: parsed.data.error_message ?? "AMIS rejected the stock ledger read request",
    };
  }

  return {
    kind: "success",
    records: parsed.data.data.map((record) => ({ sku: record.product_code, stock: record.order_quantity })),
    totalPages: parsed.data.total_pages,
  };
}

function uniqueStockLedgerRecords(records: readonly AmisStockLedgerRecord[]): readonly AmisStockLedgerRecord[] {
  const recordsBySku = new Map<string, AmisStockLedgerRecord>();
  const duplicateSkus = new Set<string>();

  for (const record of records) {
    if (recordsBySku.has(record.sku)) {
      recordsBySku.delete(record.sku);
      duplicateSkus.add(record.sku);
    } else if (!duplicateSkus.has(record.sku)) {
      recordsBySku.set(record.sku, record);
    }
  }

  return [...recordsBySku.values()];
}

const amisStockLedgerRecordSchema = z.object({
  product_code: z.string().min(1),
  order_quantity: numericValueSchema,
});

const amisStockLedgerResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  total_pages: z.number().int().positive(),
  data: z.array(amisStockLedgerRecordSchema),
  error_message: z.string().nullable().optional(),
});
