import { afterEach, describe, expect, it, vi } from "vitest";

const mockEnv = {
  CRON_SECRET: "my-cron-secret",
};

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

const mockRunInstagramSync = vi.fn();
vi.mock("@/lib/instagram-sync", () => ({
  redactError: (error: unknown) => String(error).replace(/api_key_[^\s]+/g, "[REDACTED]"),
  runInstagramSync: mockRunInstagramSync,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cron/instagram-sync", () => {
  it("returns 401 when the Authorization header is incorrect or missing", async () => {
    const { POST } = await import("./route");

    const req = new Request("https://app.test/api/cron/instagram-sync", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockRunInstagramSync).not.toHaveBeenCalled();
  });

  it("returns 200 and sanitized sync results when Authorization header is correct", async () => {
    const { POST } = await import("./route");

    mockRunInstagramSync.mockResolvedValue({
      status: "success",
      processedCount: 16,
      readyCount: 12,
      error: null,
    });

    const req = new Request("https://app.test/api/cron/instagram-sync", {
      method: "POST",
      headers: { Authorization: "Bearer my-cron-secret" },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "success",
      processedCount: 16,
      readyCount: 12,
      error: null,
    });
    expect(mockRunInstagramSync).toHaveBeenCalledOnce();
  });

  it("returns 200 and sanitizes error message if sync fails", async () => {
    const { POST } = await import("./route");

    mockRunInstagramSync.mockResolvedValue({
      status: "error",
      processedCount: 0,
      readyCount: 0,
      error: "Secret token was leaked: api_key_123",
    });

    const req = new Request("https://app.test/api/cron/instagram-sync", {
      method: "POST",
      headers: { Authorization: "Bearer my-cron-secret" },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "error",
      processedCount: 0,
      readyCount: 0,
      error: "Instagram sync failed",
    });
  });
});
