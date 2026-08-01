import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSameOriginPost } from "./same-origin.server";

describe("isSameOriginPost", () => {
  it("accepts an exact origin match", () => {
    expect(isSameOriginPost(new Request("https://staging.nanohome.vn/auth/sign-in", {
      headers: { Origin: "https://staging.nanohome.vn" },
      method: "POST",
    }))).toBe(true);
  });

  it("accepts the browser host behind a development or HTTPS reverse proxy", () => {
    expect(isSameOriginPost(new Request("http://0.0.0.0:3000/api/account/cart", {
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
      },
      method: "POST",
    }))).toBe(true);

    expect(isSameOriginPost(new Request("http://127.0.0.1:3000/api/account/cart", {
      headers: {
        Host: "internal:3000",
        Origin: "https://staging.nanohome.vn",
        "X-Forwarded-Host": "staging.nanohome.vn",
        "X-Forwarded-Proto": "https",
      },
      method: "POST",
    }))).toBe(true);
  });

  it("rejects absent, malformed, and cross-origin headers", () => {
    expect(isSameOriginPost(new Request("https://staging.nanohome.vn/auth/sign-in", {
      method: "POST",
    }))).toBe(false);
    expect(isSameOriginPost(new Request("https://staging.nanohome.vn/auth/sign-in", {
      headers: { Origin: "not-a-url" },
      method: "POST",
    }))).toBe(false);
    expect(isSameOriginPost(new Request("https://staging.nanohome.vn/auth/sign-in", {
      headers: { Origin: "https://evil.example" },
      method: "POST",
    }))).toBe(false);
    expect(isSameOriginPost(new Request("http://0.0.0.0:3000/auth/sign-in", {
      headers: { Host: "localhost:3000", Origin: "https://evil.example" },
      method: "POST",
    }))).toBe(false);
  });
});
