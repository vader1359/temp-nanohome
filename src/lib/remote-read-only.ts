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
  const request = new Request(input, init);
  assertReadOnlyMethod("Supabase", request.method, request.url);
  return fetch(input, init);
};

const SUPABASE_CHECKOUT_RPC_PATH = "/rest/v1/rpc/capture_order_from_cart";

export const supabaseCheckoutFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const method = request.method.toUpperCase();

  if (READ_ONLY_HTTP_METHODS.has(method)) {
    return fetch(input, init);
  }

  if (method !== "POST" || new URL(request.url).pathname !== SUPABASE_CHECKOUT_RPC_PATH) {
    throw new RemoteWriteBlockedError("Supabase", method, request.url);
  }

  return fetch(input, init);
};

const AMIS_SYNC_SUPABASE_WRITES = new Map<string, ReadonlySet<string>>([
  ["/rest/v1/amis_sync_log", new Set(["POST", "PATCH"])],
  ["/rest/v1/variants", new Set(["PATCH"])],
]);

export const supabaseAmisSyncFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const method = request.method.toUpperCase();

  if (!READ_ONLY_HTTP_METHODS.has(method)) {
    const allowedMethods = AMIS_SYNC_SUPABASE_WRITES.get(new URL(request.url).pathname);
    if (allowedMethods?.has(method) !== true) {
      throw new RemoteWriteBlockedError("Supabase", method, request.url);
    }
  }

  return fetch(input, init);
};

const AMIS_ALLOWED_REQUESTS = new Map<string, ReadonlySet<string>>([
  ["/api/v2/Account", new Set(["POST"])],
  ["/api/v2/Products", new Set(["GET", "HEAD"])],
  ["/api/v2/Stocks/product_ledger", new Set(["GET", "HEAD"])],
]);

export function assertAmisRequestAllowed(url: URL, method: string): void {
  const normalizedMethod = method.toUpperCase();
  const allowedMethods = AMIS_ALLOWED_REQUESTS.get(normalizeAmisPathname(url.pathname));

  if (allowedMethods?.has(normalizedMethod) !== true) {
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
