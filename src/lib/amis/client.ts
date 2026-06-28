import { z } from "zod";

import type { Env } from "@/lib/env";
import { assertAmisRequestAllowed } from "@/lib/remote-read-only";

export type AmisClientConfig = {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
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

type AccessTokenResult =
  | { readonly kind: "success"; readonly token: string }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

const AMIS_PRODUCT_PAGE_SIZE = "100";

export function createAmisClientConfig(env: Env): AmisClientConfig | null {
  if (
    env.AMIS_API_BASE_URL === undefined
    || env.AMIS_CLIENT_ID === undefined
    || env.AMIS_CLIENT_SECRET === undefined
  ) {
    return null;
  }

  return {
    baseUrl: env.AMIS_API_BASE_URL,
    clientId: env.AMIS_CLIENT_ID,
    clientSecret: env.AMIS_CLIENT_SECRET,
  };
}

export async function fetchAmisVariants(
  config: AmisClientConfig,
  watermark: string | null,
): Promise<FetchAmisVariantsResult> {
  const accessToken = await requestAccessToken(config);
  if (accessToken.kind !== "success") {
    return accessToken;
  }

  const url = new URL("/api/v2/Products", config.baseUrl);
  url.searchParams.set("page", "0");
  url.searchParams.set("pageSize", AMIS_PRODUCT_PAGE_SIZE);
  url.searchParams.set("orderBy", "modified_date");
  url.searchParams.set("isDescending", "true");

  // This is the only AMIS business-data request in this client. Its method is
  // intentionally fixed to GET so callers cannot issue writes to CRM.
  assertAmisRequestAllowed(url, "GET");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken.token}`,
      Clientid: config.clientId,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return { kind: "http_error", status: response.status, message: await response.text() };
  }

  const parsed = amisProductsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { kind: "malformed", message: parsed.error.message };
  }

  if (!parsed.data.success || parsed.data.code !== 200) {
    return {
      kind: "http_error",
      status: parsed.data.code,
      message: parsed.data.error_message ?? "AMIS rejected the product read request",
    };
  }

  return {
    kind: "success",
    records: parsed.data.data
      .filter((record) => isAfterWatermark(record.modified_date, watermark))
      .map(toAmisVariantRecord),
  };
}

async function requestAccessToken(config: AmisClientConfig): Promise<AccessTokenResult> {
  const url = new URL("/api/v2/Account", config.baseUrl);
  assertAmisRequestAllowed(url, "POST");
  const response = await fetch(url, {
    // MISA documents this POST as the authentication/token exchange endpoint.
    // It does not create, update, or delete CRM business data.
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return { kind: "http_error", status: response.status, message: await response.text() };
  }

  const parsed = amisTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { kind: "malformed", message: parsed.error.message };
  }

  if (!parsed.data.success || parsed.data.code !== 0) {
    return {
      kind: "http_error",
      status: parsed.data.code,
      message: parsed.data.error_message ?? "AMIS rejected the token request",
    };
  }

  return { kind: "success", token: parsed.data.data };
}

function isAfterWatermark(modifiedDate: string, watermark: string | null): boolean {
  return watermark === null || Date.parse(modifiedDate) > Date.parse(watermark);
}

const amisTokenResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.string().min(1),
  error_message: z.string().nullable().optional(),
});

const numericValueSchema = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    context.addIssue({ code: "custom", message: "Expected a finite numeric value" });
    return z.NEVER;
  }
  return parsed;
});

const amisProductSchema = z.object({
  product_code: z.string().min(1),
  unit_price: numericValueSchema.nullable().optional(),
  modified_date: z.string().datetime({ offset: true }),
});

const amisProductsResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.array(amisProductSchema),
  error_message: z.string().nullable().optional(),
});

type ParsedAmisProduct = z.infer<typeof amisProductSchema>;

function toAmisVariantRecord(product: ParsedAmisProduct): AmisVariantRecord {
  return {
    sku: product.product_code,
    price: product.unit_price,
    sourceUpdatedAt: product.modified_date,
  };
}
