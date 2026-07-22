import { describe, expect, it, vi } from "vitest";
import { customerMemoryFixture } from "@/lib/contracts";
import { createSupabaseCustomerMemoryPort } from "./supabase-customer-memory-port";

const options = {
  accessToken: "account-access-token",
  baseUrl: "https://supabase.test",
  publishableKey: "public-key",
  now: () => "2026-07-23T00:00:00.000Z",
};

describe("Supabase customer memory port", () => {
  it("returns only the authenticated customer's safe, active projection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{
      memory: customerMemoryFixture,
      expires_at: "2026-08-23T00:00:00.000Z",
    }]), { status: 200 }));
    const port = createSupabaseCustomerMemoryPort({ ...options, fetcher });

    await expect(port.getForAuthenticatedCustomer({
      userId: "account-1",
      purpose: "personalization",
    })).resolves.toEqual(customerMemoryFixture);

    const [input, init] = fetcher.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/customer_memory_projections");
    expect(url.searchParams.get("select")).toBe("memory,expires_at");
    expect(url.searchParams.get("user_id")).toBe("eq.account-1");
    expect(init).toMatchObject({ cache: "no-store" });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer account-access-token");
  });

  it("fails closed for expired or malformed projections", async () => {
    const expired = createSupabaseCustomerMemoryPort({
      ...options,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{
        memory: customerMemoryFixture,
        expires_at: "2026-07-22T00:00:00.000Z",
      }]), { status: 200 })),
    });
    const malformed = createSupabaseCustomerMemoryPort({
      ...options,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{
        memory: { rawNotes: "not allowed" },
        expires_at: null,
      }]), { status: 200 })),
    });

    await expect(expired.getForAuthenticatedCustomer({
      userId: "account-1",
      purpose: "personalization",
    })).resolves.toBeNull();
    await expect(malformed.getForAuthenticatedCustomer({
      userId: "account-1",
      purpose: "personalization",
    })).resolves.toBeNull();
  });

  it("does not read a projection for another purpose", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const port = createSupabaseCustomerMemoryPort({ ...options, fetcher });

    await expect(port.getForAuthenticatedCustomer({
      userId: "account-1",
      purpose: "concierge",
    })).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
