const READ_ONLY_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const REMOTE_ACCESS_MODE = "read_only" as const;

export class RemoteWriteBlockedError extends Error {
  constructor(system: "AMIS" | "Supabase", method: string, url: string) {
    super(`${system} write blocked by read-only safeguard: ${method} ${url}`);
    this.name = "RemoteWriteBlockedError";
  }
}

const SUPABASE_READ_RPC_PATHS = new Set([
  "/rest/v1/rpc/search_variant_products_fuzzy",
  "/rest/v1/rpc/search_variant_products_fuzzy_count",
]);

const SUPABASE_AUTH_WRITE_PATHS = new Map<string, ReadonlySet<string>>([
  ["/auth/v1/token", new Set(["POST"])],
  ["/auth/v1/signup", new Set(["POST"])],
  ["/auth/v1/logout", new Set(["POST"])],
  ["/auth/v1/recover", new Set(["POST"])],
  ["/auth/v1/verify", new Set(["POST"])],
  ["/auth/v1/otp", new Set(["POST"])],
  ["/auth/v1/reauthenticate", new Set(["POST"])],
  ["/auth/v1/resend", new Set(["POST"])],
  ["/auth/v1/user", new Set(["PUT", "PATCH"])],
]);

export const supabaseReadOnlyFetch: typeof fetch = async (input, init) => {
  const { request, signal } = safeCreateRequest(input, init);
  assertReadOnlyMethod("Supabase", request.method, request.url);
  return supabaseNetworkFetch(request, signal);
};

const SUPABASE_CHECKOUT_RPC_PATH = "/rest/v1/rpc/capture_order_from_cart";

export const supabaseCheckoutFetch: typeof fetch = async (input, init) => {
  const { request, signal } = safeCreateRequest(input, init);
  const method = request.method.toUpperCase();

  if (READ_ONLY_HTTP_METHODS.has(method)) {
    return supabaseNetworkFetch(request, signal);
  }

  if (method !== "POST" || new URL(request.url).pathname !== SUPABASE_CHECKOUT_RPC_PATH) {
    throw new RemoteWriteBlockedError("Supabase", method, request.url);
  }

  return supabaseNetworkFetch(request, signal);
};

const AMIS_SYNC_SUPABASE_WRITES = new Map<string, ReadonlySet<string>>([
  ["/rest/v1/rpc/apply_amis_inventory_sync", new Set(["POST"])],
  ["/rest/v1/amis_sync_log", new Set(["POST", "PATCH"])],
  ["/rest/v1/variants", new Set(["PATCH"])],
]);

export const supabaseAmisSyncFetch: typeof fetch = async (input, init) => {
  const { request, signal } = safeCreateRequest(input, init);
  const method = request.method.toUpperCase();

  if (!READ_ONLY_HTTP_METHODS.has(method)) {
    const allowedMethods = AMIS_SYNC_SUPABASE_WRITES.get(new URL(request.url).pathname);
    if (allowedMethods?.has(method) !== true) {
      throw new RemoteWriteBlockedError("Supabase", method, request.url);
    }
  }

  return supabaseNetworkFetch(request, signal);
};

const INSTAGRAM_SYNC_SUPABASE_WRITES = new Map<string, ReadonlySet<string>>([
  ["/rest/v1/rpc/begin_instagram_snapshot_stage", new Set(["POST"])],
  ["/rest/v1/rpc/save_instagram_stage_drafts", new Set(["POST"])],
  ["/rest/v1/rpc/get_instagram_stage_work", new Set(["POST"])],
  ["/rest/v1/rpc/get_instagram_stage_pending_videos", new Set(["POST"])],
  ["/rest/v1/rpc/publish_instagram_stage", new Set(["POST"])],
  ["/rest/v1/rpc/update_instagram_stage_wistia_status", new Set(["POST"])],
  ["/rpc/begin_instagram_snapshot_stage", new Set(["POST"])],
  ["/rpc/save_instagram_stage_drafts", new Set(["POST"])],
  ["/rpc/get_instagram_stage_work", new Set(["POST"])],
  ["/rpc/get_instagram_stage_pending_videos", new Set(["POST"])],
  ["/rpc/publish_instagram_stage", new Set(["POST"])],
  ["/rpc/update_instagram_stage_wistia_status", new Set(["POST"])],
]);

export const supabaseInstagramSyncFetch: typeof fetch = async (input, init) => {
  const { request, signal } = safeCreateRequest(input, init);
  const method = request.method.toUpperCase();

  if (!READ_ONLY_HTTP_METHODS.has(method)) {
    const allowedMethods = INSTAGRAM_SYNC_SUPABASE_WRITES.get(new URL(request.url).pathname);
    if (allowedMethods?.has(method) !== true) {
      throw new RemoteWriteBlockedError("Supabase", method, request.url);
    }
  }

  return supabaseNetworkFetch(request, signal);
};

const AMIS_CRM_ORIGIN = "https://crmconnect.misa.vn";

const AMIS_ALLOWED_REQUESTS = new Map<string, ReadonlySet<string>>([
  ["/api/v2/Account", new Set(["POST"])],
  ["/api/v2/Products", new Set(["GET", "HEAD"])],
  ["/api/v2/Stocks/product_ledger", new Set(["GET", "HEAD"])],
  ["/api/v2/SaleOrders", new Set(["GET", "HEAD"])],
  ["/api/v2/Customers", new Set(["GET", "HEAD"])],
  ["/api/v2/Contacts", new Set(["GET", "HEAD"])],
]);

export function assertAmisRequestAllowed(url: URL, method: string): void {
  const normalizedMethod = method.toUpperCase();
  const pathname = normalizeAmisPathname(url.pathname);
  const allowedMethods = AMIS_ALLOWED_REQUESTS.get(pathname);

  if (
    url.origin !== AMIS_CRM_ORIGIN
    || url.username.length > 0
    || url.password.length > 0
    || allowedMethods?.has(normalizedMethod) !== true
  ) {
    throw new RemoteWriteBlockedError("AMIS", normalizedMethod, url.toString());
  }
  if ((pathname === "/api/v2/Customers" || pathname === "/api/v2/Contacts") && !hasSafeAmisPagingQuery(url)) {
    throw new RemoteWriteBlockedError("AMIS", normalizedMethod, url.toString());
  }
}

export const amisReadOnlyFetch: typeof fetch = async (input, init) => {
  assertAmisRequestAllowed(resolveRequestUrl(input), resolveRequestMethod(input, init));
  return fetch(input, init);
};

function resolveRequestUrl(input: RequestInfo | URL): URL {
  if (typeof input === "string" || input instanceof URL) {
    return new URL(String(input));
  }
  return new URL(input.url);
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method !== undefined && init.method.length > 0) {
    return init.method;
  }
  if (typeof input !== "string" && !(input instanceof URL)) {
    return input.method;
  }
  return "GET";
}

function normalizeAmisPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function hasSafeAmisPagingQuery(url: URL): boolean {
  const allowedKeys = new Set(["page", "pageSize", "orderBy", "isDescending"]);
  for (const key of url.searchParams.keys()) {
    if (!allowedKeys.has(key) || url.searchParams.getAll(key).length !== 1) return false;
  }
  const page = url.searchParams.get("page");
  const pageSize = url.searchParams.get("pageSize");
  const orderBy = url.searchParams.get("orderBy");
  const isDescending = url.searchParams.get("isDescending");
  return (page === null || /^(0|[1-9]\d*)$/.test(page))
    && (pageSize === null || (/^(?:[1-9]|[1-9]\d|100)$/.test(pageSize)))
    && (orderBy === null || orderBy === "modified_date")
    && (isDescending === null || isDescending === "true");
}

function assertReadOnlyMethod(system: "Supabase", method: string, url: string): void {
  const normalizedMethod = method.toUpperCase();
  const pathname = new URL(url).pathname;
  if (normalizedMethod === "POST" && SUPABASE_READ_RPC_PATHS.has(pathname)) {
    return;
  }

  if (SUPABASE_AUTH_WRITE_PATHS.get(pathname)?.has(normalizedMethod) === true) {
    return;
  }

  if (!READ_ONLY_HTTP_METHODS.has(normalizedMethod)) {
    throw new RemoteWriteBlockedError(system, normalizedMethod, url);
  }
}

async function supabaseNetworkFetch(request: Request, signal?: AbortSignal | null): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";
  const startsWithRestV1 = url.pathname.startsWith("/rest/v1");

  if (!isLocal || !startsWithRestV1) {
    return fetch(request, { signal });
  }

  const firstRequest = request.clone();
  const response = await fetch(firstRequest, { signal });

  if (response.status === 404) {
    try {
      const clone = response.clone();
      const data = await clone.json();
      if (data && typeof data === "object" && data.code === "PGRST125") {
        const newUrl = new URL(request.url);
        newUrl.pathname = url.pathname.replace(/^\/rest\/v1/, "");

        const headers = new Headers(request.headers);
        const method = request.method;
        const body = request.body;
        const duplex = (request as any).duplex;

        const retryInit: RequestInit = {
          method,
          headers,
        };
        if (body !== null) {
          retryInit.body = body;
        }
        if (duplex) {
          (retryInit as any).duplex = duplex;
        }

        const retryRequest = new Request(newUrl.toString(), retryInit);
        return fetch(retryRequest, { signal });
      }
    } catch {
      // JSON parsing or check failed, do not retry
    }
  }

  return response;
}

function safeCreateRequest(input: RequestInfo | URL, init?: RequestInit): { request: Request; signal?: AbortSignal | null } {
  let signal: AbortSignal | null | undefined = init?.signal;

  if (input instanceof Request) {
    if (!signal) {
      signal = input.signal;
    }
    const headers = new Headers(input.headers);
    const method = input.method;
    const body = input.body;
    const duplex = (input as any).duplex;

    const newInit: RequestInit = {
      method,
      headers,
    };
    if (body !== null) {
      newInit.body = body;
    }
    if (duplex) {
      (newInit as any).duplex = duplex;
    }
    if (init) {
      Object.assign(newInit, init);
      delete newInit.signal;
    }
    return {
      request: new Request(input.url, newInit),
      signal,
    };
  } else {
    const newInit = init ? { ...init } : undefined;
    if (newInit) {
      delete newInit.signal;
    }
    return {
      request: new Request(input, newInit),
      signal,
    };
  }
}
