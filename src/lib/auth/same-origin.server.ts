import "server-only";

export function isSameOriginPost(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  if (originHeader === null) return false;

  try {
    const origin = new URL(originHeader).origin;
    const requestUrl = new URL(request.url);
    if (origin === requestUrl.origin) return true;

    const forwardedProtocol = request.headers.get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const protocols = new Set([
      requestUrl.protocol.replace(/:$/u, ""),
      ...(forwardedProtocol === "http" || forwardedProtocol === "https"
        ? [forwardedProtocol]
        : []),
    ]);
    const hosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? null,
    ].filter((host): host is string => host !== null && host.length > 0);

    return hosts.some((host) => Array.from(protocols).some((protocol) => {
      try {
        return new URL(`${protocol}://${host}`).origin === origin;
      } catch {
        return false;
      }
    }));
  } catch {
    return false;
  }
}
