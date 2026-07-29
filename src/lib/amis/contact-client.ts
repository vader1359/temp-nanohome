import { z } from "zod";

import type { AmisClientConfig } from "@/lib/amis/client";
import { requestAccessToken } from "@/lib/amis/client";
import { amisReadOnlyFetch } from "@/lib/remote-read-only";

const AMIS_CONTACT_PAGE_SIZE = 100;

export type AmisContactRecord = {
  readonly id: string;
  readonly code: string;
  readonly customerCode: string | null;
  readonly inactive: boolean | null;
  readonly modifiedDate: string;
};

export type FetchAmisContactsResult =
  | { readonly kind: "success"; readonly records: readonly AmisContactRecord[] }
  | { readonly kind: "http_error"; readonly status: number; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string };

export async function fetchAmisContacts(
  config: AmisClientConfig,
  watermark: string | null,
): Promise<FetchAmisContactsResult> {
  const token = await requestAccessToken(config);
  if (token.kind !== "success") return token;

  const records: AmisContactRecord[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchContactPage(config, token.token, page);
    if (result.kind !== "success") return result;
    records.push(...result.records.filter((record) => watermark === null || Date.parse(record.modifiedDate) >= Date.parse(watermark)));
    if (result.records.length < AMIS_CONTACT_PAGE_SIZE || (watermark !== null && result.records.some((record) => Date.parse(record.modifiedDate) < Date.parse(watermark)))) {
      return { kind: "success", records };
    }
  }
}

type ContactPageResult = Exclude<FetchAmisContactsResult, { readonly kind: "success" }> | {
  readonly kind: "success";
  readonly records: readonly AmisContactRecord[];
};

async function fetchContactPage(config: AmisClientConfig, token: string, page: number): Promise<ContactPageResult> {
  const url = new URL("/api/v2/Contacts", config.baseUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(AMIS_CONTACT_PAGE_SIZE));
  url.searchParams.set("orderBy", "modified_date");
  url.searchParams.set("isDescending", "true");
  const response = await amisReadOnlyFetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, Clientid: config.clientId },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { kind: "http_error", status: response.status, message: "AMIS Contact read failed" };
  const parsed = contactsResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { kind: "malformed", message: "AMIS Contact payload is malformed" };
  if (!parsed.data.success || parsed.data.code !== 200) {
    return { kind: "http_error", status: parsed.data.code, message: "AMIS rejected the Contact read request" };
  }
  return {
    kind: "success",
    records: parsed.data.data.map((record) => ({
      id: record.id,
      code: record.contact_code,
      customerCode: record.account_code ?? null,
      inactive: record.inactive ?? null,
      modifiedDate: record.modified_date,
    })),
  };
}

const contactSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().safe()]).transform(String),
  contact_code: z.string().min(1),
  account_code: z.string().min(1).nullable().optional(),
  inactive: z.boolean().nullable().optional(),
  modified_date: z.string().datetime({ offset: true }),
}).strip();

const contactsResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.array(contactSchema),
}).strip();
