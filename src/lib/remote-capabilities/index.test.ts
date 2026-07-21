import { afterEach, describe, expect, it, vi } from "vitest";

import { createRemoteCapability } from "@/lib/remote-capabilities";

const capability = createRemoteCapability({
  origin: "https://api.example.test",
  methods: ["GET", "HEAD"],
  paths: ["/v1/products"],
  purpose: "Read products",
  owner: "catalog-service",
  responseContentTypes: ["application/json"],
  maxResponseBytes: 32,
  timeoutMs: 100,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remote capability fetch", () => {
  it("allows the exact HTTPS origin, method, and path", async () => {
    const networkFetch = vi.fn(async () => new Response('{"ok":true}', {
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", networkFetch);

    const response = await capability.fetch("https://api.example.test/v1/products");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    "not a URL",
    "http://api.example.test/v1/products",
    "https://api.example.test.evil/v1/products",
    "https://user:pass@api.example.test/v1/products",
     "https://api.example.test/v1/products/123",
     "https://api.example.test/v1/products?limit=1",

    "https://api.example.test/v1/../admin",
    "https://api.example.test/v1/%2e%2e/admin",
  ])("rejects unsafe or near-miss URL %s before network I/O", async (url) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(capability.fetch(url)).rejects.toThrow();
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "TRACE"]) (
    "rejects unsupported method %s before network I/O",
    async (method) => {
      const networkFetch = vi.fn();
      vi.stubGlobal("fetch", networkFetch);

      await expect(capability.fetch("https://api.example.test/v1/products", { method }))
        .rejects.toThrow();
      expect(networkFetch).not.toHaveBeenCalled();
    },
  );

  it.each(["authorization", "cookie"])("rejects forwarded %s headers", async (header) => {
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    await expect(capability.fetch("https://api.example.test/v1/products", {
      headers: { [header]: "secret" },
    })).rejects.toThrow();
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("follows one same-origin redirect to an allowlisted path", async () => {
    const networkFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "/v1/products" },
      }))
      .mockResolvedValueOnce(new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", networkFetch);

    const response = await capability.fetch("https://api.example.test/v1/products");

    expect(await response.text()).toBe('{"ok":true}');
    expect(networkFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects cross-origin and near-path redirects", async () => {
    const networkFetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://evil.example/v1/products" },
    }));
    vi.stubGlobal("fetch", networkFetch);

    await expect(capability.fetch("https://api.example.test/v1/products")).rejects.toThrow();
  });

  it("rejects an oversized response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("123456789012345678901234567890123" , {
      headers: { "content-type": "application/json" },
    })));

    await expect(capability.fetch("https://api.example.test/v1/products")).rejects.toThrow();
  });

  it("rejects an unsupported response content type", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html />", {
      headers: { "content-type": "text/html" },
    })));

    await expect(capability.fetch("https://api.example.test/v1/products")).rejects.toThrow();
  });

  it("aborts a timed-out request", async () => {
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation timed out", "TimeoutError")));
    })));

    await expect(capability.fetch("https://api.example.test/v1/products")).rejects.toThrow();
  });
});
