import "server-only";

const READ_METHODS = new Set(["GET", "HEAD"]);

export type SePayTestAttempt = Readonly<{
  readonly amount: number;
  readonly attemptId: string;
  readonly created: boolean;
  readonly currency: "VND";
  readonly expiresAt: string;
  readonly merchantReference: string;
  readonly providerCheckoutUrl: string;
  readonly providerOrderId: string;
  readonly state: "created" | "pending" | "authorized" | "succeeded" | "failed" | "expired" | "cancelled";
}>;

export type ExpectedSePayTestPayment = Readonly<{
  readonly amount: number;
  readonly currency: "VND";
  readonly environment: "sandbox";
  readonly merchantReference: string;
  readonly state: SePayTestAttempt["state"];
}>;

export type AccountPaymentStatus = Readonly<{
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentState: "failed" | "paid" | "pending";
  readonly updatedAt: string;
}>;

export interface SePayTestRepository {
  readonly applyVerifiedIpn: (input: Readonly<{
    readonly amount: number;
    readonly merchantReference: string;
    readonly payloadDigest: string;
    readonly providerEventId: string;
    readonly providerTransactionId: string;
    readonly receivedAt: Date;
  }>) => Promise<"applied" | "conflict" | "duplicate" | "not_found" | "rejected">;
  readonly createAttempt: (
    accountId: string,
    orderId: string,
    idempotencyKey: string,
  ) => Promise<SePayTestAttempt>;
  readonly getExpectedPayment: (
    merchantReference: string,
  ) => Promise<ExpectedSePayTestPayment | null>;
  readonly getPaymentStatus: (
    accountId: string,
    orderId: string,
  ) => Promise<AccountPaymentStatus | null>;
}

export class SePayTestRepositoryError extends Error {
  constructor(readonly code: "invalid_environment" | "mutation_disabled" | "request_failed") {
    super(code);
    this.name = "SePayTestRepositoryError";
  }
}

type AttemptRow = Readonly<{
  amount: number | string;
  attempt_id: string;
  attempt_state: SePayTestAttempt["state"];
  created: boolean;
  currency: string;
  expires_at: string;
  merchant_reference: string;
  provider_checkout_url: string;
  provider_order_id: string;
}>;

type ExpectedRow = Readonly<{
  amount: number | string;
  currency: string;
  merchant_reference: string;
  provider_environment: string;
  state: SePayTestAttempt["state"];
}>;

type OrderStatusRow = Readonly<{
  id: string;
  payment_status: string;
  updated_at: string;
  web_order_number: string;
}>;

export function createSePayTestRepository(options: Readonly<{
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
  readonly mutationsEnabled: boolean;
  readonly projectRef: string;
  readonly serviceRoleKey: string;
}>): SePayTestRepository {
  const baseUrl = new URL(options.baseUrl);
  assertSafeHost(baseUrl, options.projectRef);
  const fetcher = options.fetcher ?? fetch;

  async function requestPayload(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ body?: unknown; method?: string }> = {},
  ): Promise<unknown> {
    const method = (init.method ?? "GET").toUpperCase();
    if (!READ_METHODS.has(method) && !options.mutationsEnabled) {
      throw new SePayTestRepositoryError("mutation_disabled");
    }
    const url = new URL(`/rest/v1/${resource}`, baseUrl);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    let response: Response;
    try {
      response = await fetcher(url, {
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          apikey: options.serviceRoleKey,
          Authorization: `Bearer ${options.serviceRoleKey}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SePayTestRepositoryError("request_failed");
    }
    if (!response.ok) throw new SePayTestRepositoryError("request_failed");
    return response.status === 204 ? [] : response.json().catch(() => null);
  }

  async function requestRows<T>(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ body?: unknown; method?: string }> = {},
  ): Promise<readonly T[]> {
    const payload = await requestPayload(resource, query, init);
    if (!Array.isArray(payload)) throw new SePayTestRepositoryError("request_failed");
    return payload as readonly T[];
  }

  return {
    async createAttempt(accountId, orderId, idempotencyKey) {
      const rows = await requestRows<AttemptRow>("rpc/create_customer_sepay_test_attempt", {}, {
        body: {
          p_account_id: accountId,
          p_idempotency_key: idempotencyKey,
          p_order_id: orderId,
        },
        method: "POST",
      });
      const row = rows[0];
      if (row === undefined
        || row.currency !== "VND"
        || typeof row.attempt_id !== "string"
        || typeof row.created !== "boolean"
        || typeof row.expires_at !== "string"
        || typeof row.merchant_reference !== "string"
        || typeof row.provider_checkout_url !== "string"
        || typeof row.provider_order_id !== "string") {
        throw new SePayTestRepositoryError("request_failed");
      }
      return {
        amount: positiveInteger(row.amount),
        attemptId: row.attempt_id,
        created: row.created,
        currency: "VND",
        expiresAt: row.expires_at,
        merchantReference: row.merchant_reference,
        providerCheckoutUrl: row.provider_checkout_url,
        providerOrderId: row.provider_order_id,
        state: row.attempt_state,
      };
    },
    async getExpectedPayment(merchantReference) {
      const rows = await requestRows<ExpectedRow>("payment_attempts", {
        limit: "1",
        merchant_reference: `eq.${merchantReference}`,
        provider: "eq.sepay",
        provider_environment: "eq.sandbox",
        select: "merchant_reference,amount,currency,state,provider_environment",
      });
      const row = rows[0];
      if (row === undefined) return null;
      if (row.currency !== "VND"
        || row.provider_environment !== "sandbox"
        || row.merchant_reference !== merchantReference) {
        throw new SePayTestRepositoryError("request_failed");
      }
      return {
        amount: positiveInteger(row.amount),
        currency: "VND",
        environment: "sandbox",
        merchantReference: row.merchant_reference,
        state: row.state,
      };
    },
    async applyVerifiedIpn(input) {
      const payload = await requestPayload("rpc/apply_sepay_test_ipn", {}, {
        body: {
          p_amount: input.amount,
          p_merchant_reference: input.merchantReference,
          p_payload_digest: input.payloadDigest,
          p_provider_event_id: input.providerEventId,
          p_provider_transaction_id: input.providerTransactionId,
          p_received_at: input.receivedAt.toISOString(),
        },
        method: "POST",
      });
      if (payload !== "applied"
        && payload !== "conflict"
        && payload !== "duplicate"
        && payload !== "not_found"
        && payload !== "rejected") {
        throw new SePayTestRepositoryError("request_failed");
      }
      return payload;
    },
    async getPaymentStatus(accountId, orderId) {
      const orders = await requestRows<OrderStatusRow>("orders", {
        account_id: `eq.${accountId}`,
        id: `eq.${orderId}`,
        limit: "1",
        owner_scope: "eq.auth",
        select: "id,web_order_number,payment_status,updated_at",
      });
      const order = orders[0];
      if (order === undefined) return null;
      const attempts = await requestRows<Readonly<{ state: SePayTestAttempt["state"] }>>(
        "payment_attempts",
        {
          limit: "1",
          order_id: `eq.${orderId}`,
          provider: "eq.sepay",
          provider_environment: "eq.sandbox",
          select: "state",
        },
      );
      const attemptState = attempts[0]?.state;
      return {
        orderId: order.id,
        orderNumber: order.web_order_number,
        paymentState: order.payment_status === "paid"
          ? "paid"
          : attemptState === "failed"
            || attemptState === "expired"
            || attemptState === "cancelled"
            ? "failed"
            : "pending",
        updatedAt: order.updated_at,
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
    throw new SePayTestRepositoryError("invalid_environment");
  }
}

function positiveInteger(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new SePayTestRepositoryError("request_failed");
  }
  return parsed;
}
