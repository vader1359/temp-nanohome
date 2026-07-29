import "server-only";

import { createHash } from "node:crypto";

import type { AccountCheckoutInput, CheckoutDelivery } from "./delivery";

const knownRpcErrors = new Set([
  "checkout_cart_not_found",
  "checkout_empty_cart",
  "checkout_idempotency_conflict",
  "checkout_invalid_cart",
  "checkout_invalid_request",
  "checkout_unauthorized",
]);

export type CapturedAccountOrder = Readonly<{
  readonly amount: number;
  readonly currency: "VND";
  readonly merchantReference: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly replayed: boolean;
}>;

export interface AccountCheckoutRepository {
  readonly captureOrder: (
    accountId: string,
    input: AccountCheckoutInput,
  ) => Promise<CapturedAccountOrder>;
}

export class AccountCheckoutRepositoryError extends Error {
  constructor(readonly code:
    | "invalid_environment"
    | "mutation_disabled"
    | "request_failed"
    | "checkout_cart_not_found"
    | "checkout_empty_cart"
    | "checkout_idempotency_conflict"
    | "checkout_invalid_cart"
    | "checkout_invalid_request"
    | "checkout_unauthorized") {
    super(code);
    this.name = "AccountCheckoutRepositoryError";
  }
}

type CaptureRow = Readonly<{
  amount: number | string;
  currency: string;
  merchant_reference: string;
  order_id: string;
  order_number: string;
  replayed: boolean;
}>;

export function createAccountCheckoutRepository(options: Readonly<{
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
  readonly mutationsEnabled: boolean;
  readonly projectRef: string;
  readonly serviceRoleKey: string;
}>): AccountCheckoutRepository {
  const baseUrl = new URL(options.baseUrl);
  assertSafeHost(baseUrl, options.projectRef);
  const fetcher = options.fetcher ?? fetch;

  return {
    async captureOrder(accountId, input) {
      if (!options.mutationsEnabled) {
        throw new AccountCheckoutRepositoryError("mutation_disabled");
      }
      const delivery = deliveryFromInput(input);
      const response = await request(fetcher, baseUrl, options.serviceRoleKey, {
        p_account_id: accountId,
        p_address: delivery.address,
        p_city: delivery.city ?? null,
        p_district: delivery.district ?? null,
        p_email: delivery.email,
        p_full_name: delivery.fullName,
        p_idempotency_key: input.idempotencyKey,
        p_note: delivery.note ?? null,
        p_phone: delivery.phone,
        p_request_digest: digestDelivery(delivery),
        p_ward: delivery.ward ?? null,
      });
      const row = response[0];
      if (row === undefined
        || row.currency !== "VND"
        || typeof row.merchant_reference !== "string"
        || typeof row.order_id !== "string"
        || typeof row.order_number !== "string"
        || typeof row.replayed !== "boolean") {
        throw new AccountCheckoutRepositoryError("request_failed");
      }
      return {
        amount: positiveInteger(row.amount),
        currency: "VND",
        merchantReference: row.merchant_reference,
        orderId: row.order_id,
        orderNumber: row.order_number,
        replayed: row.replayed,
      };
    },
  };
}

function assertSafeHost(url: URL, projectRef: string): void {
  const local = url.hostname === "localhost"
    || url.hostname === "127.0.0.1"
    || url.hostname === "::1";
  if ((!local && url.protocol !== "https:")
    || !/^[a-z0-9-]+$/.test(projectRef)
    || (!local && url.hostname !== `${projectRef}.supabase.co`)) {
    throw new AccountCheckoutRepositoryError("invalid_environment");
  }
}

function deliveryFromInput(input: AccountCheckoutInput): CheckoutDelivery {
  const { idempotencyKey: _idempotencyKey, ...delivery } = input;
  return delivery;
}

function digestDelivery(delivery: CheckoutDelivery): string {
  return createHash("sha256").update(JSON.stringify([
    delivery.fullName,
    delivery.email,
    delivery.phone,
    delivery.address,
    delivery.city ?? null,
    delivery.district ?? null,
    delivery.ward ?? null,
    delivery.note ?? null,
  ])).digest("hex");
}

function positiveInteger(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AccountCheckoutRepositoryError("request_failed");
  }
  return parsed;
}

async function request(
  fetcher: typeof fetch,
  baseUrl: URL,
  serviceRoleKey: string,
  body: Readonly<Record<string, unknown>>,
): Promise<readonly CaptureRow[]> {
  let response: Response;
  try {
    response = await fetcher(new URL(
      "/rest/v1/rpc/capture_customer_account_order",
      baseUrl,
    ), {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AccountCheckoutRepositoryError("request_failed");
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = typeof payload === "object"
      && payload !== null
      && "message" in payload
      && typeof payload.message === "string"
      ? payload.message
      : null;
    if (message !== null && knownRpcErrors.has(message)) {
      throw new AccountCheckoutRepositoryError(
        message as AccountCheckoutRepositoryError["code"],
      );
    }
    throw new AccountCheckoutRepositoryError("request_failed");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!Array.isArray(payload)) throw new AccountCheckoutRepositoryError("request_failed");
  return payload as readonly CaptureRow[];
}
