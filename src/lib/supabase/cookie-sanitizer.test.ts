import { describe, expect, it } from "vitest";
import { sanitizeCookies } from "./cookie-sanitizer";

describe("sanitizeCookies", () => {
  it("retains valid raw JSON cookies", () => {
    const rawJson = JSON.stringify({ access_token: "xyz", user: { id: "1" } });
    const cookies = [
      { name: "sb-myproj-auth-token", value: rawJson },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toContainEqual({ name: "sb-myproj-auth-token", value: rawJson });
    expect(result).toContainEqual({ name: "other-cookie", value: "ok" });
    expect(result).toHaveLength(2);
  });

  it("retains valid url-encoded JSON cookies", () => {
    const rawJson = JSON.stringify({ access_token: "xyz", user: { id: "1" } });
    const encoded = encodeURIComponent(rawJson);
    const cookies = [
      { name: "sb-myproj-auth-token", value: encoded }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual(cookies);
  });

  it("retains valid base64url-encoded cookies starting with base64-", () => {
    const rawJson = JSON.stringify({ access_token: "xyz", user: { id: "1" } });
    // Encode to base64url
    const base64 = btoa(rawJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const value = `base64-${base64}`;
    const cookies = [
      { name: "sb-myproj-auth-token", value }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual(cookies);
  });

  it("discards corrupted single auth cookie", () => {
    const cookies = [
      { name: "sb-myproj-auth-token", value: "invalid-json" },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([{ name: "other-cookie", value: "ok" }]);
  });

  it("retains valid chunked cookies", () => {
    const rawJson = JSON.stringify({ access_token: "xyz", user: { id: "1" } });
    const base64 = btoa(rawJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const value = `base64-${base64}`;
    const half = Math.ceil(value.length / 2);
    const chunk0 = value.slice(0, half);
    const chunk1 = value.slice(half);

    const cookies = [
      { name: "sb-myproj-auth-token.0", value: chunk0 },
      { name: "sb-myproj-auth-token.1", value: chunk1 },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([
      { name: "other-cookie", value: "ok" },
      { name: "sb-myproj-auth-token.0", value: chunk0 },
      { name: "sb-myproj-auth-token.1", value: chunk1 }
    ]);
  });

  it("discards chunked group if one chunk is missing or index has gaps", () => {
    const rawJson = JSON.stringify({ access_token: "xyz", user: { id: "1" } });
    const base64 = btoa(rawJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const value = `base64-${base64}`;
    const half = Math.ceil(value.length / 2);
    const chunk0 = value.slice(0, half);
    const chunk1 = value.slice(half);

    // Missing index 0, starts at 1
    const cookies1 = [
      { name: "sb-myproj-auth-token.1", value: chunk1 },
      { name: "other-cookie", value: "ok" }
    ];
    expect(sanitizeCookies(cookies1)).toEqual([{ name: "other-cookie", value: "ok" }]);

    // Gap in indices: 0 and 2, but no 1
    const cookies2 = [
      { name: "sb-myproj-auth-token.0", value: chunk0 },
      { name: "sb-myproj-auth-token.2", value: chunk1 },
      { name: "other-cookie", value: "ok" }
    ];
    expect(sanitizeCookies(cookies2)).toEqual([{ name: "other-cookie", value: "ok" }]);
  });

  it("discards chunked group if final combined JSON is invalid", () => {
    const cookies = [
      { name: "sb-myproj-auth-token.0", value: "base64-invalidpart1" },
      { name: "sb-myproj-auth-token.1", value: "invalidpart2" },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([{ name: "other-cookie", value: "ok" }]);
  });

  it("valid unchunked cookie wins even if stale/invalid chunk cookies exist", () => {
    const validRawJson = JSON.stringify({ access_token: "valid-unchunked", user: { id: "1" } });
    const cookies = [
      { name: "sb-myproj-auth-token", value: validRawJson },
      { name: "sb-myproj-auth-token.0", value: "stale-chunk-0" },
      { name: "sb-myproj-auth-token.1", value: "stale-chunk-1" },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([
      { name: "other-cookie", value: "ok" },
      { name: "sb-myproj-auth-token", value: validRawJson }
    ]);
  });

  it("discards entire group if unchunked cookie is invalid and chunk cookies exist", () => {
    const cookies = [
      { name: "sb-myproj-auth-token", value: "invalid-unchunked-json" },
      { name: "sb-myproj-auth-token.0", value: "base64-eyJhY2Nlc3NfdG9rZW4iOiJ4" },
      { name: "sb-myproj-auth-token.1", value: "eXoiLCJ1c2VyIjp7ImlkIjoiMSJ9fQ" },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([
      { name: "other-cookie", value: "ok" }
    ]);
  });

  it("supports large chunked data crossing boundaries (e.g. 3180)", () => {
    // Generate a payload of over 4000 characters
    const largeObj = { access_token: "x".repeat(3500), user: { id: "1" } };
    const rawJson = JSON.stringify(largeObj);
    const base64 = btoa(rawJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const value = `base64-${base64}`;

    // Split at 3180 characters to cross boundary
    const chunk0 = value.slice(0, 3180);
    const chunk1 = value.slice(3180);

    const cookies = [
      { name: "sb-myproj-auth-token.0", value: chunk0 },
      { name: "sb-myproj-auth-token.1", value: chunk1 },
      { name: "other-cookie", value: "ok" }
    ];
    const result = sanitizeCookies(cookies);
    expect(result).toEqual([
      { name: "other-cookie", value: "ok" },
      { name: "sb-myproj-auth-token.0", value: chunk0 },
      { name: "sb-myproj-auth-token.1", value: chunk1 }
    ]);
  });
});
