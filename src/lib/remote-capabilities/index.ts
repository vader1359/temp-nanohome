import "server-only";

const FORWARDED_HEADERS = new Set(["authorization", "cookie"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type RemoteCapabilityConfig = {
  readonly origin: string;
  readonly methods: readonly string[];
  readonly paths: readonly string[];
  readonly purpose: string;
  readonly owner: string;
  readonly responseContentTypes: readonly string[];
  readonly maxResponseBytes: number;
  readonly timeoutMs: number;
};

export type RemoteCapability = {
  readonly origin: string;
  readonly methods: readonly string[];
  readonly paths: readonly string[];
  readonly purpose: string;
  readonly owner: string;
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export class RemoteCapabilityDeniedError extends Error {
  readonly name = "RemoteCapabilityDeniedError";

  constructor(readonly reason: string) {
    super(`Remote capability denied: ${reason}`);
  }
}

export function createRemoteCapability(config: RemoteCapabilityConfig): RemoteCapability {
  const origin = validateOrigin(config.origin);
  const methods = config.methods.map(normalizeMethod);
  const paths = config.paths.map(validatePath);
  validateConfig(config, methods, paths);

  return {
    origin,
    methods,
    paths,
    purpose: config.purpose,
    owner: config.owner,
    fetch: (input, init) => capabilityFetch(config, origin, methods, paths, input, init),
  };
}

function validateOrigin(origin: string): string {
  const parsed = parseUrl(origin);
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    throw new RemoteCapabilityDeniedError("origin must be an exact HTTPS origin");
  }
  return parsed.origin;
}

function validatePath(path: string): string {
  if (!path.startsWith("/") || path.includes("?") || path.includes("#") || path.includes("..") || path.endsWith("/")) {
    throw new RemoteCapabilityDeniedError("path must be an anchored, normalized pathname");
  }
  return path;
}

function validateConfig(config: RemoteCapabilityConfig, methods: readonly string[], paths: readonly string[]): void {
  if (methods.length === 0 || paths.length === 0 || config.purpose.trim() === "" || config.owner.trim() === "") {
    throw new RemoteCapabilityDeniedError("capability metadata and allowlists are required");
  }
  if (!Number.isSafeInteger(config.maxResponseBytes) || config.maxResponseBytes <= 0 || !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    throw new RemoteCapabilityDeniedError("response and timeout limits must be positive safe integers");
  }
}

function normalizeMethod(method: string): string {
  const normalized = method.toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    throw new RemoteCapabilityDeniedError("method must be a valid token");
  }
  return normalized;
}

async function capabilityFetch(
  config: RemoteCapabilityConfig,
  origin: string,
  methods: readonly string[],
  paths: readonly string[],
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = createRequest(input, init);
  const url = parseUrl(request.url);
  ensureAllowedRequest(url, request.method, origin, methods, paths);
  for (const header of request.headers.keys()) {
    if (FORWARDED_HEADERS.has(header.toLowerCase())) {
      throw new RemoteCapabilityDeniedError(`forwarded ${header} header is forbidden`);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const signal = combineSignals(request.signal, controller.signal);
  try {
    const response = await fetchWithSameOriginRedirect(request, signal, origin, methods, paths);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType === undefined || !config.responseContentTypes.map((type) => type.toLowerCase()).includes(contentType)) {
      throw new RemoteCapabilityDeniedError("response content type is not allowlisted");
    }
    return await boundedResponse(response, config.maxResponseBytes);
  } finally {
    clearTimeout(timer);
  }
}

function ensureAllowedRequest(url: URL, method: string, origin: string, methods: readonly string[], paths: readonly string[]): void {
  if (url.origin !== origin || url.search !== "" || url.hash !== "" || !paths.includes(url.pathname) || !methods.includes(method)) {
    throw new RemoteCapabilityDeniedError("URL or method is not allowlisted");
  }
}

async function fetchWithSameOriginRedirect(
  request: Request,
  signal: AbortSignal,
  origin: string,
  methods: readonly string[],
  paths: readonly string[],
): Promise<Response> {
  const response = await fetch(request, { redirect: "manual", signal });
  if (!REDIRECT_STATUSES.has(response.status)) return response;
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new RemoteCapabilityDeniedError("redirects require a safe request method");
  }
  const location = response.headers.get("location");
  if (location === null) throw new RemoteCapabilityDeniedError("redirect location is missing");
  const redirectUrl = parseUrl(new URL(location, request.url).toString());
  ensureAllowedRequest(redirectUrl, request.method, origin, methods, paths);
  const redirectedRequest = new Request(redirectUrl, {
    method: request.method,
    headers: request.headers,
  });
  return fetch(redirectedRequest, { redirect: "error", signal });
}

function createRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  try {
    return new Request(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new RemoteCapabilityDeniedError("request is malformed");
    }
    throw error;
  }
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new RemoteCapabilityDeniedError("URL is malformed");
    }
    throw error;
  }
}

function combineSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  if (first.aborted) {
    return first;
  }
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  first.addEventListener("abort", abort, { once: true });
  second.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function boundedResponse(response: Response, maxBytes: number): Promise<Response> {
  if (response.body === null) {
    return response;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    total += result.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RemoteCapabilityDeniedError("response body exceeds the configured limit");
    }
    chunks.push(result.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
