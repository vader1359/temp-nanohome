import { z } from "zod";

import type { Env } from "@/lib/env";

export type AmisClientConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly tenant?: string;
};

export type AmisVariantRecord = {
  readonly sku: string;
  readonly price?: number | null;
  readonly compareAtPrice?: number | null;
  readonly discountPercent?: number | null;
  readonly inStock?: boolean;
  readonly sourceUpdatedAt?: string | null;
};

export type FetchAmisVariantsResult =
  | { readonly kind: "success"; readonly records: readonly AmisVariantRecord[] }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

export function createAmisClientConfig(env: Env): AmisClientConfig | null {
  if (env.AMIS_API_BASE_URL === undefined || env.AMIS_API_KEY === undefined) {
    return null;
  }

  return {
    baseUrl: env.AMIS_API_BASE_URL,
    apiKey: env.AMIS_API_KEY,
    tenant: env.AMIS_TENANT,
  };
}

export async function fetchAmisVariants(config: AmisClientConfig, watermark: string | null): Promise<FetchAmisVariantsResult> {
  const url = new URL("/api/v1/inventory/items", config.baseUrl);
  url.searchParams.set("limit", "200");

  if (watermark !== null) {
    url.searchParams.set("updated_since", watermark);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: createHeaders(config),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return { kind: "http_error", status: response.status, message: await response.text() };
  }

  const parsed = amisPayloadSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { kind: "malformed", message: parsed.error.message };
  }

  return { kind: "success", records: parsed.data.data.map(toAmisVariantRecord) };
}

function createHeaders(config: AmisClientConfig): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "X-API-Key": config.apiKey,
  });

  if (config.tenant !== undefined) {
    headers.set("X-Tenant", config.tenant);
  }

  return headers;
}

const amisRecordSchema = z.object({
  sku: z.string().min(1),
  price: z.number().finite().nullable().optional(),
  compare_at_price: z.number().finite().nullable().optional(),
  compareAtPrice: z.number().finite().nullable().optional(),
  discount_percent: z.number().finite().nullable().optional(),
  discountPercent: z.number().finite().nullable().optional(),
  in_stock: z.boolean().optional(),
  inStock: z.boolean().optional(),
  source_updated_at: z.string().datetime({ offset: true }).nullable().optional(),
  sourceUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const amisPayloadSchema = z.object({
  data: z.array(amisRecordSchema),
});

type ParsedAmisRecord = z.infer<typeof amisRecordSchema>;

function toAmisVariantRecord(record: ParsedAmisRecord): AmisVariantRecord {
  return {
    sku: record.sku,
    price: record.price,
    compareAtPrice: record.compare_at_price ?? record.compareAtPrice,
    discountPercent: record.discount_percent ?? record.discountPercent,
    inStock: record.in_stock ?? record.inStock,
    sourceUpdatedAt: record.source_updated_at ?? record.sourceUpdatedAt,
  };
}
