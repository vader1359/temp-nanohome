import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("/api/account/auth-flow", () => {
  it("fails closed so stale fake-provider clients cannot authenticate", async () => {
    const response = await POST();

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ error: "Authentication flow retired" });
  });
});
