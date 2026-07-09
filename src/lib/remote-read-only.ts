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

export function assertAmisRequestAllowed(url: URL, method: string): void {
  const normalizedMethod = method.toUpperCase();
  const isTokenExchange = normalizedMethod === "POST" && url.pathname === "/api/v2/Account";

  if (!READ_ONLY_HTTP_METHODS.has(normalizedMethod) && !isTokenExchange) {
    throw new RemoteWriteBlockedError("AMIS", normalizedMethod, url.toString());
  }
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
