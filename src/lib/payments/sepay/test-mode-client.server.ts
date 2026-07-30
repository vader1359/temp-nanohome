import "server-only";

import { z } from "zod";

import {
  isSePayTestPaymentReference,
  SEPAY_TEST_VIETQR_URL,
} from "./checkout";

export const SEPAY_TEST_API_BASE_URL = "https://userapi-sandbox.sepay.vn/v2";
export { SEPAY_TEST_VIETQR_URL };
const MAXIMUM_TEST_MODE_AMOUNT = 499_000_000;
const TEST_ORDER_DURATION_SECONDS = 24 * 60 * 60;

const bankAccountSchema = z.object({
  account_type: z.literal("business_household"),
  active: z.literal("1"),
  bank_code: z.literal("VCB"),
  id: z.string().uuid(),
}).passthrough();

const bankAccountsEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  status: z.string(),
}).passthrough();

const terminalSchema = z.object({
  tid: z.string().trim().regex(/^[A-Z0-9]+$/u),
  xid: z.string().uuid(),
}).passthrough();

const terminalsEnvelopeSchema = z.object({
  data: z.array(terminalSchema),
  status: z.string(),
}).passthrough();

const createdOrderEnvelopeSchema = z.object({
  data: z.object({
    amount: z.number().int().safe().positive(),
    id: z.string().uuid(),
    order_code: z.string(),
    status: z.literal("Pending"),
    va: z.array(z.object({
      status: z.literal("Unpaid"),
      va_number: z.string().trim().regex(/^[A-Z0-9]+$/u),
    }).passthrough()).min(1),
  }).passthrough(),
  status: z.string(),
}).passthrough();

const orderListEnvelopeSchema = z.object({
  data: z.array(z.object({
    amount: z.number().int().safe().positive(),
    id: z.string().uuid(),
    order_code: z.string(),
    status: z.enum(["Pending", "Partially", "Paid"]),
    va: z.array(z.object({
      status: z.enum(["Unpaid", "Paid"]),
      va_number: z.string().trim().regex(/^[A-Z0-9]+$/u),
    }).passthrough()).min(1),
  }).passthrough()),
  status: z.string(),
}).passthrough();

export type SePayTestVietQr = Readonly<{
  readonly paymentUrl: string;
}>;

export class SePayTestModeClientError extends Error {
  constructor(readonly code:
    | "invalid_configuration"
    | "invalid_payment"
    | "rate_limited"
    | "request_failed") {
    super(code);
    this.name = "SePayTestModeClientError";
  }
}

export async function createSePayTestModeVietQr(input: Readonly<{
  readonly amount: number;
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly bankAccountId: string;
  readonly fetcher?: typeof fetch;
  readonly merchantReference: string;
}>): Promise<SePayTestVietQr> {
  assertConfiguration(input);
  if (!Number.isSafeInteger(input.amount)
    || input.amount < 1_000
    || input.amount > MAXIMUM_TEST_MODE_AMOUNT
    || !isSePayTestPaymentReference(input.merchantReference)) {
    throw new SePayTestModeClientError("invalid_payment");
  }

  const fetcher = input.fetcher ?? fetch;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${input.apiToken}`,
  };
  const accountsPayload = await requestJson(fetcher, bankAccountsUrl(), { headers });
  const accounts = bankAccountsEnvelopeSchema.safeParse(accountsPayload);
  const accountCandidate = accounts.success
    ? accounts.data.data.find((candidate) =>
      typeof candidate === "object"
      && candidate !== null
      && "id" in candidate
      && candidate.id === input.bankAccountId)
    : undefined;
  const account = bankAccountSchema.safeParse(accountCandidate);
  if (!account.success) throw new SePayTestModeClientError("request_failed");

  const terminalsPayload = await requestJson(
    fetcher,
    new URL(`${SEPAY_TEST_API_BASE_URL}/bank-accounts/${input.bankAccountId}/terminals`),
    { headers },
  );
  const terminals = terminalsEnvelopeSchema.safeParse(terminalsPayload);
  if (!terminals.success || terminals.data.data.length !== 1) {
    throw new SePayTestModeClientError("request_failed");
  }

  const ordersUrl = new URL(
    `${SEPAY_TEST_API_BASE_URL}/bank-accounts/${input.bankAccountId}/orders`,
  );
  const createResponse = await request(
    fetcher,
    ordersUrl,
    {
      body: JSON.stringify({
        amount: input.amount,
        duration: TEST_ORDER_DURATION_SECONDS,
        order_code: input.merchantReference,
        qrcode_template: "compact",
        tid: terminals.data.data[0].tid,
        with_qrcode: "1",
      }),
      headers: { ...headers, "Content-Type": "application/json" },
      method: "POST",
    },
    [409],
  );

  let vaNumber: string;
  if (createResponse.status === 409) {
    ordersUrl.searchParams.set("per_page", "100");
    const existingPayload = await requestJson(fetcher, ordersUrl, { headers });
    const existing = orderListEnvelopeSchema.safeParse(existingPayload);
    const order = existing.success
      ? existing.data.data.find((candidate) =>
        candidate.order_code === input.merchantReference
        && candidate.amount === input.amount
        && candidate.status !== "Paid")
      : undefined;
    const va = order?.va.find((candidate) => candidate.status === "Unpaid");
    if (va === undefined) throw new SePayTestModeClientError("request_failed");
    vaNumber = va.va_number;
  } else {
    const createdPayload: unknown = await createResponse.json().catch(() => null);
    const created = createdOrderEnvelopeSchema.safeParse(createdPayload);
    if (!created.success
      || created.data.data.amount !== input.amount
      || created.data.data.order_code !== input.merchantReference) {
      throw new SePayTestModeClientError("request_failed");
    }
    vaNumber = created.data.data.va[0].va_number;
  }

  const paymentUrl = new URL(SEPAY_TEST_VIETQR_URL);
  paymentUrl.searchParams.set("acc", vaNumber);
  paymentUrl.searchParams.set("bank", account.data.bank_code);
  paymentUrl.searchParams.set("amount", String(input.amount));
  paymentUrl.searchParams.set("des", input.merchantReference);
  paymentUrl.searchParams.set("template", "compact");
  paymentUrl.searchParams.set("showinfo", "true");
  paymentUrl.searchParams.set("fullacc", "true");
  return { paymentUrl: paymentUrl.toString() };
}

function bankAccountsUrl(): URL {
  const url = new URL(`${SEPAY_TEST_API_BASE_URL}/bank-accounts`);
  url.searchParams.set("per_page", "100");
  return url;
}

async function requestJson(
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit,
): Promise<unknown> {
  const response = await request(fetcher, url, init);
  return response.json().catch(() => null);
}

async function request(
  fetcher: typeof fetch,
  url: URL,
  init: RequestInit,
  allowedErrorStatuses: readonly number[] = [],
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    throw new SePayTestModeClientError("request_failed");
  }
  if (response.status === 429) throw new SePayTestModeClientError("rate_limited");
  if (!response.ok && !allowedErrorStatuses.includes(response.status)) {
    throw new SePayTestModeClientError("request_failed");
  }
  return response;
}

function assertConfiguration(input: Readonly<{
  readonly apiBaseUrl: string;
  readonly apiToken: string;
  readonly bankAccountId: string;
}>): void {
  let apiBaseUrl: URL;
  try {
    apiBaseUrl = new URL(input.apiBaseUrl);
  } catch {
    throw new SePayTestModeClientError("invalid_configuration");
  }
  if (apiBaseUrl.toString().replace(/\/$/u, "") !== SEPAY_TEST_API_BASE_URL
    || input.apiToken.trim() === ""
    || !z.string().uuid().safeParse(input.bankAccountId).success) {
    throw new SePayTestModeClientError("invalid_configuration");
  }
}
