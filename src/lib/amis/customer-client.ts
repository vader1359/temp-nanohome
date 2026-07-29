import { z } from "zod";

import type { AmisClientConfig } from "@/lib/amis/client";
import { requestAccessToken } from "@/lib/amis/client";
import { amisReadOnlyFetch } from "@/lib/remote-read-only";

const AMIS_CUSTOMER_PAGE_SIZE = 100;

export type AmisCustomerRecord = {
  readonly id: string;
  readonly code: string;
  readonly customerType: string | null;
  readonly inactive: boolean | null;
  readonly modifiedDate: string;
};

export type FetchAmisCustomersResult =
  | { readonly kind: "success"; readonly records: readonly AmisCustomerRecord[] }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

export async function fetchAmisCustomers(
  config: AmisClientConfig,
  watermark: string | null,
): Promise<FetchAmisCustomersResult> {
  const token = await requestAccessToken(config);
  if (token.kind !== "success") return token;

  const records: AmisCustomerRecord[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchCustomerPage(config, token.token, page);
    if (result.kind !== "success") return result;
    records.push(...result.records.filter((record) => watermark === null || Date.parse(record.modifiedDate) >= Date.parse(watermark)));
    if (result.records.length < AMIS_CUSTOMER_PAGE_SIZE || (watermark !== null && result.records.some((record) => Date.parse(record.modifiedDate) < Date.parse(watermark)))) {
      return { kind: "success", records };
    }
  }
}

type CustomerPageResult = Exclude<FetchAmisCustomersResult, { readonly kind: "success" }> | {
  readonly kind: "success";
  readonly records: readonly AmisCustomerRecord[];
};

async function fetchCustomerPage(config: AmisClientConfig, token: string, page: number): Promise<CustomerPageResult> {
  const url = new URL("/api/v2/Customers", config.baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(AMIS_CUSTOMER_PAGE_SIZE));
  url.searchParams.set("orderBy", "modified_date");
  url.searchParams.set("isDescending", "true");
  const response = await amisReadOnlyFetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, Clientid: config.clientId },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { kind: "http_error", status: response.status, message: "AMIS Customer read failed" };
  const parsed = customersResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { kind: "malformed", message: "AMIS Customer payload is malformed" };
  if (!parsed.data.success || parsed.data.code !== 200) {
    return { kind: "http_error", status: parsed.data.code, message: "AMIS rejected the Customer read request" };
  }
  return {
    kind: "success",
    records: parsed.data.data.map((record) => ({
      id: record.id,
      code: record.account_number,
      customerType: record.account_type ?? null,
      inactive: record.inactive ?? null,
      modifiedDate: record.modified_date,
    })),
  };
}

const customerSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().safe()]).transform(String),
  account_number: z.string().min(1),
  account_type: z.string().nullable().optional(),
  inactive: z.boolean().nullable().optional(),
  modified_date: z.string().datetime({ offset: true }),
}).strip();

const customersResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.array(customerSchema),
}).strip();
