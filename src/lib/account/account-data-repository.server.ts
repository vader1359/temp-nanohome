import "server-only";

import type { ProfilePatch } from "./profile-schema";
import type { AccountIdentityRepositoryInput, AccountIdentityResolution } from "./identity-resolution";

const READ_METHODS = new Set(["GET", "HEAD"]);

export type StoredAccountProfile = Readonly<{
  readonly fullName: string | null;
  readonly dateOfBirth: string | null;
  readonly nationality: string | null;
  readonly formOfAddress: string | null;
  readonly locale: string | null;
}>;

export type StoredVerifiedContactKind = "email" | "phone";

export type StoredWishlistItem = Readonly<{
  readonly available: boolean;
  readonly productSlug: string | null;
  readonly title: string;
  readonly variantId: string;
}>;

export type StoredOrderItem = Readonly<{
  readonly productName: string | null;
  readonly quantity: number;
  readonly sku: string | null;
  readonly unitPrice: number | null;
  readonly variantName: string | null;
}>;

export type StoredAccountOrder = Readonly<{
  readonly businessStatus: string;
  readonly currency: string;
  readonly fulfillmentStatus: string;
  readonly grandTotal: number;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentStatus: string;
  readonly placedAt: string;
  readonly refundStatus: string;
  readonly items: readonly StoredOrderItem[];
}>;

export type StoredAccountCartItem = Readonly<{
  readonly available: boolean;
  readonly productSlug: string | null;
  readonly quantity: number;
  readonly title: string;
  readonly unitAmount: number;
  readonly variantId: string;
}>;

export type StoredAccountCart = Readonly<{
  readonly items: readonly StoredAccountCartItem[];
  readonly version: number;
}>;

export type StoredCartMutationResult = Readonly<{
  readonly status: "unavailable" | "updated" | "version_conflict";
  readonly version: number;
}>;

export type StoredGuestCartMergeResult = Readonly<{
  readonly changedLines: number;
  readonly removedLines: number;
  readonly version: number;
}>;

export interface AccountDataRepository {
  readonly addWishlistItem: (accountId: string, variantId: string) => Promise<void>;
  readonly getCart: (accountId: string) => Promise<StoredAccountCart>;
  readonly getOrder: (accountId: string, orderId: string) => Promise<StoredAccountOrder | null>;
  readonly getProfile: (accountId: string) => Promise<StoredAccountProfile | null>;
  readonly getVerifiedContactKinds: (accountId: string) => Promise<readonly StoredVerifiedContactKind[]>;
  readonly listOrders: (
    accountId: string,
    page: Readonly<{ limit: number; offset: number }>,
  ) => Promise<readonly StoredAccountOrder[]>;
  readonly listWishlistItems: (accountId: string) => Promise<readonly StoredWishlistItem[]>;
  readonly mergeWishlistItems: (
    accountId: string,
    idempotencyKey: string,
    variantIds: readonly string[],
  ) => Promise<void>;
  readonly mergeGuestCart: (
    accountId: string,
    idempotencyKey: string,
    items: readonly Readonly<{ readonly quantity: number; readonly variantId: string }>[],
  ) => Promise<StoredGuestCartMergeResult>;
  readonly mutateCart: (
    accountId: string,
    input: Readonly<{
      readonly expectedVersion: number;
      readonly operation: "add" | "remove" | "update";
      readonly quantity: number | null;
      readonly variantId: string;
    }>,
  ) => Promise<StoredCartMutationResult>;
  readonly patchProfile: (accountId: string, patch: ProfilePatch) => Promise<StoredAccountProfile>;
  readonly removeWishlistItem: (accountId: string, variantId: string) => Promise<void>;
  readonly resolveAccountId: (firebaseUid: string) => Promise<string | null>;
  readonly resolveOrCreateAccount: (input: AccountIdentityRepositoryInput) => Promise<AccountIdentityResolution>;
}

type AccountDataRepositoryOptions = Readonly<{
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
  readonly mutationsEnabled: boolean;
  readonly projectRef: string;
  readonly serviceRoleKey: string;
}>;

type ProfileRow = Readonly<{
  full_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  form_of_address: string | null;
  preferred_locale: string | null;
}>;

type CatalogRow = Readonly<{
  localized_product_name: string | null;
  localized_name?: string | null;
  price?: number | string | null;
  product_name: string | null;
  product_slug: string | null;
  storefront: boolean | null;
  cart?: boolean | null;
  variant_id: string | null;
  variant_name?: string | null;
}>;

type CartRow = Readonly<{ id: string; version: number | string }>;
type CartItemRow = Readonly<{ quantity: number; variant_id: string }>;
type CartMutationRow = Readonly<{
  cart_version: number | string;
  result_status: "unavailable" | "updated" | "version_conflict";
}>;

type OrderRow = Readonly<{
  business_status: string;
  created_at: string;
  currency: string;
  fulfillment_status: string;
  grand_total: number;
  id: string;
  order_items?: readonly Readonly<{
    price: number | null;
    product_name: string | null;
    quantity: number;
    sku: string | null;
    variant_name: string | null;
  }>[];
  payment_status: string;
  refund_status: string;
  web_order_number: string;
}>;

export class AccountDataRepositoryError extends Error {
  constructor(readonly code: "invalid_environment" | "mutation_disabled" | "request_failed") {
    super(code);
    this.name = "AccountDataRepositoryError";
  }
}

export function createAccountDataRepository(
  options: AccountDataRepositoryOptions,
): AccountDataRepository {
  const baseUrl = new URL(options.baseUrl);
  assertSafeAccountDataHost(baseUrl, options.projectRef);
  const fetcher = options.fetcher ?? fetch;

  async function requestPayload(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ body?: unknown; method?: string; prefer?: string }> = {},
  ): Promise<unknown> {
    const method = (init.method ?? "GET").toUpperCase();
    if (!READ_METHODS.has(method) && !options.mutationsEnabled) {
      throw new AccountDataRepositoryError("mutation_disabled");
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
          Authorization: `Bearer ${options.serviceRoleKey}`,
          apikey: options.serviceRoleKey,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(init.prefer === undefined ? {} : { Prefer: init.prefer }),
        },
        method,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AccountDataRepositoryError("request_failed");
    }

    if (!response.ok) throw new AccountDataRepositoryError("request_failed");
    if (response.status === 204) return [];
    return response.json().catch(() => null);
  }

  async function requestRows<T>(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ body?: unknown; method?: string; prefer?: string }> = {},
  ): Promise<readonly T[]> {
    const payload = await requestPayload(resource, query, init);
    if (!Array.isArray(payload)) throw new AccountDataRepositoryError("request_failed");
    return payload as readonly T[];
  }

  async function getProfile(accountId: string): Promise<StoredAccountProfile | null> {
    const rows = await requestRows<ProfileRow>("customer_account_profiles", {
      account_id: `eq.${accountId}`,
      limit: "1",
      select: "full_name,date_of_birth,nationality,form_of_address,preferred_locale",
    });
    return rows[0] === undefined ? null : presentProfile(rows[0]);
  }

  async function getVerifiedContactKinds(accountId: string): Promise<readonly StoredVerifiedContactKind[]> {
    const rows = await requestRows<Readonly<{ kind: string }>>("customer_account_verified_identities", {
      account_id: `eq.${accountId}`,
      kind: "in.(email,phone)",
      select: "kind",
      status: "eq.active",
    });
    return [...new Set(rows.flatMap((row): StoredVerifiedContactKind[] => {
      if (row.kind === "email" || row.kind === "phone") return [row.kind];
      return [];
    }))];
  }

  async function getOrderRows(
    accountId: string,
    extra: Readonly<Record<string, string>>,
  ): Promise<readonly OrderRow[]> {
    return requestRows<OrderRow>("orders", {
      account_id: `eq.${accountId}`,
      owner_scope: "eq.auth",
      select: [
        "id",
        "web_order_number",
        "created_at",
        "grand_total",
        "currency",
        "business_status",
        "payment_status",
        "fulfillment_status",
        "refund_status",
        "order_items(product_name,variant_name,sku,price,quantity)",
      ].join(","),
      ...extra,
    });
  }

  async function getCart(accountId: string): Promise<StoredAccountCart> {
    const carts = await requestRows<CartRow>("carts", {
      account_id: `eq.${accountId}`,
      limit: "1",
      select: "id,version",
    });
    const cart = carts[0];
    if (cart === undefined) return { items: [], version: 0 };

    const cartItems = await requestRows<CartItemRow>("cart_items", {
      cart_id: `eq.${cart.id}`,
      order: "created_at.asc,variant_id.asc",
      select: "variant_id,quantity",
    });
    if (cartItems.length === 0) {
      return { items: [], version: integerValue(cart.version) };
    }

    const variantIds = cartItems.map((item) => item.variant_id);
    const catalog = await requestRows<CatalogRow>("catalog_eligibility", {
      select: [
        "variant_id",
        "product_slug",
        "localized_product_name",
        "product_name",
        "localized_name",
        "variant_name",
        "price",
        "cart",
      ].join(","),
      variant_id: `in.(${variantIds.join(",")})`,
    });
    const catalogByVariant = new Map(
      catalog.flatMap((row) => row.variant_id === null ? [] : [[row.variant_id, row] as const]),
    );

    return {
      items: cartItems.map((item) => {
        const row = catalogByVariant.get(item.variant_id);
        const unitAmount = moneyValue(row?.price);
        return {
          available: row?.cart === true && unitAmount !== null,
          productSlug: row?.product_slug ?? null,
          quantity: integerValue(item.quantity),
          title: row?.localized_product_name
            ?? row?.product_name
            ?? row?.localized_name
            ?? row?.variant_name
            ?? "Sản phẩm không còn khả dụng",
          unitAmount: unitAmount ?? 0,
          variantId: item.variant_id,
        };
      }),
      version: integerValue(cart.version),
    };
  }

  return {
    async resolveAccountId(firebaseUid) {
      const principals = await requestRows<Readonly<{ account_id: string }>>(
        "customer_firebase_principals",
        {
          firebase_uid: `eq.${firebaseUid}`,
          limit: "1",
          select: "account_id",
          status: "eq.active",
        },
      );
      const accountId = principals[0]?.account_id;
      if (accountId === undefined) return null;
      const accounts = await requestRows<Readonly<{ id: string }>>("customer_accounts", {
        id: `eq.${accountId}`,
        limit: "1",
        select: "id",
        state: "eq.active",
      });
      return accounts[0]?.id ?? null;
    },
    async resolveOrCreateAccount(input) {
      const rows = await requestRows<Readonly<{
        account_id: string;
        outcome: "created" | "existing_principal";
      }>>("rpc/resolve_or_create_account", {}, {
        body: {
          p_email_digest: input.emailDigest,
          p_firebase_uid: input.firebaseUid,
          p_idempotency_key: input.idempotencyKey,
          p_phone_digest: input.phoneDigest,
          p_policy_versions: input.policyVersions,
        },
        method: "POST",
      });
      const row = rows[0];
      if (
        row === undefined
        || row.account_id.trim() === ""
        || !["created", "existing_principal"].includes(row.outcome)
      ) {
        throw new AccountDataRepositoryError("request_failed");
      }
      return { accountId: row.account_id, outcome: row.outcome };
    },
    getProfile,
    getVerifiedContactKinds,
    async patchProfile(accountId, patch) {
      const body = {
        account_id: accountId,
        ...profilePatchRow(patch),
      };
      const rows = await requestRows<ProfileRow>("customer_account_profiles", {
        on_conflict: "account_id",
        select: "full_name,date_of_birth,nationality,form_of_address,preferred_locale",
      }, {
        body,
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
      });
      const profile = rows[0];
      if (profile === undefined) throw new AccountDataRepositoryError("request_failed");
      return presentProfile(profile);
    },
    async listWishlistItems(accountId) {
      const wishlist = await requestRows<Readonly<{ variant_id: string }>>(
        "customer_wishlist_items",
        {
          account_id: `eq.${accountId}`,
          order: "created_at.desc,variant_id.asc",
          select: "variant_id",
        },
      );
      const variantIds = wishlist.map((row) => row.variant_id);
      if (variantIds.length === 0) return [];
      const catalog = await requestRows<CatalogRow>("catalog_eligibility", {
        select: "variant_id,product_slug,localized_product_name,product_name,storefront",
        variant_id: `in.(${variantIds.join(",")})`,
      });
      const catalogByVariant = new Map(
        catalog.flatMap((row) => row.variant_id === null ? [] : [[row.variant_id, row] as const]),
      );
      return variantIds.map((variantId) => {
        const row = catalogByVariant.get(variantId);
        return {
          available: row?.storefront === true,
          productSlug: row?.product_slug ?? null,
          title: row?.localized_product_name ?? row?.product_name ?? "Sản phẩm đã lưu",
          variantId,
        };
      });
    },
    async addWishlistItem(accountId, variantId) {
      await requestRows("customer_wishlist_items", {}, {
        body: { account_id: accountId, variant_id: variantId },
        method: "POST",
        prefer: "resolution=ignore-duplicates,return=minimal",
      });
    },
    async removeWishlistItem(accountId, variantId) {
      await requestRows("customer_wishlist_items", {
        account_id: `eq.${accountId}`,
        variant_id: `eq.${variantId}`,
      }, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    },
    async mergeWishlistItems(accountId, idempotencyKey, variantIds) {
      await requestRows("rpc/merge_customer_wishlist_items", {}, {
        body: {
          p_account_id: accountId,
          p_idempotency_key: idempotencyKey,
          p_variant_ids: variantIds,
        },
        method: "POST",
        prefer: "return=minimal",
      });
    },
    getCart,
    async mutateCart(accountId, input) {
      const rows = await requestRows<CartMutationRow>("rpc/mutate_customer_account_cart", {}, {
        body: {
          p_account_id: accountId,
          p_expected_version: input.expectedVersion,
          p_operation: input.operation,
          p_quantity: input.quantity,
          p_variant_id: input.variantId,
        },
        method: "POST",
      });
      const result = rows[0];
      if (result === undefined) throw new AccountDataRepositoryError("request_failed");
      return {
        status: result.result_status,
        version: integerValue(result.cart_version),
      };
    },
    async mergeGuestCart(accountId, idempotencyKey, items) {
      const payload = await requestPayload("rpc/merge_customer_guest_cart", {}, {
        body: {
          p_account_id: accountId,
          p_idempotency_key: idempotencyKey,
          p_items: items,
        },
        method: "POST",
      });
      if (!isRecord(payload)) throw new AccountDataRepositoryError("request_failed");
      const changedLines = integerValue(payload.changedLines);
      const removedLines = integerValue(payload.removedLines);
      const version = integerValue(payload.version);
      if (changedLines < 0 || removedLines < 0 || version < 0) {
        throw new AccountDataRepositoryError("request_failed");
      }
      return { changedLines, removedLines, version };
    },
    async listOrders(accountId, page) {
      const rows = await getOrderRows(accountId, {
        limit: String(page.limit),
        offset: String(page.offset),
        order: "created_at.desc,id.desc",
      });
      return rows.map(presentOrder);
    },
    async getOrder(accountId, orderId) {
      const rows = await getOrderRows(accountId, {
        id: `eq.${orderId}`,
        limit: "1",
      });
      return rows[0] === undefined ? null : presentOrder(rows[0]);
    },
  };
}

function integerValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new AccountDataRepositoryError("request_failed");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function moneyValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function assertSafeAccountDataHost(url: URL, projectRef: string): void {
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !local) {
    throw new AccountDataRepositoryError("invalid_environment");
  }
  if (!/^[a-z0-9-]+$/.test(projectRef) || (!local && url.hostname !== `${projectRef}.supabase.co`)) {
    throw new AccountDataRepositoryError("invalid_environment");
  }
}

function presentProfile(row: ProfileRow): StoredAccountProfile {
  return {
    dateOfBirth: row.date_of_birth,
    formOfAddress: row.form_of_address,
    fullName: row.full_name,
    locale: row.preferred_locale,
    nationality: row.nationality,
  };
}

function profilePatchRow(patch: ProfilePatch): Readonly<Record<string, string | null>> {
  return {
    ...("fullName" in patch ? { full_name: patch.fullName ?? null } : {}),
    ...("dateOfBirth" in patch ? { date_of_birth: patch.dateOfBirth ?? null } : {}),
    ...("nationality" in patch ? { nationality: patch.nationality ?? null } : {}),
    ...("formOfAddress" in patch ? { form_of_address: patch.formOfAddress ?? null } : {}),
    ...("locale" in patch ? { preferred_locale: patch.locale ?? "vi" } : {}),
  };
}

function presentOrder(row: OrderRow): StoredAccountOrder {
  return {
    businessStatus: row.business_status,
    currency: row.currency,
    fulfillmentStatus: row.fulfillment_status,
    grandTotal: row.grand_total,
    items: (row.order_items ?? []).map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      sku: item.sku,
      unitPrice: item.price,
      variantName: item.variant_name,
    })),
    orderId: row.id,
    orderNumber: row.web_order_number,
    paymentStatus: row.payment_status,
    placedAt: row.created_at,
    refundStatus: row.refund_status,
  };
}
