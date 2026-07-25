import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
}));
const customerRepository = vi.hoisted(() => ({
  resolveIdentity: vi.fn(),
  currentConsent: vi.fn(),
}));
const loadPlan07CustomerFeatures = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));
vi.mock("@/lib/customer-context/repository", () => ({
  createCustomerRepository: vi.fn(() => customerRepository),
}));
vi.mock("@/lib/personalization/customer-runtime", () => ({
  loadPlan07CustomerFeatures,
}));

import { GET } from "./route";

describe("GET /api/customer/personalization", () => {
  beforeEach(() => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("returns a private no-store response when authentication is absent", async () => {
    const response = await GET(new Request("https://app.test/api/customer/personalization?locale=en"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale before touching authentication", async () => {
    auth.getUser.mockClear();

    const response = await GET(new Request("https://app.test/api/customer/personalization?locale=fr"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale" });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("returns the disabled default before reading customer features when settings are absent", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: "test-token" } } });
    customerRepository.resolveIdentity.mockClear();
    loadPlan07CustomerFeatures.mockClear();

    const response = await GET(new Request("https://app.test/api/customer/personalization?locale=en"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      consent: false,
      mode: "default",
      preferences: [],
      recent: [],
      memoryConnected: false,
      memorySummary: null,
    });
    expect(customerRepository.resolveIdentity).not.toHaveBeenCalled();
    expect(loadPlan07CustomerFeatures).not.toHaveBeenCalled();
  });
});
