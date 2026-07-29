export function sameOriginRequest(input: string | URL, init?: RequestInit): Request {
  const url = new URL(input);
  const headers = new Headers(init?.headers);
  if (!headers.has("origin")) headers.set("origin", url.origin);
  return new Request(url, { ...init, headers });
}
