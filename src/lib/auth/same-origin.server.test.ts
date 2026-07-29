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
  });
});
