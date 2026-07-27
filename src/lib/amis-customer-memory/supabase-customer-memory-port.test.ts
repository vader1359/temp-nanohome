import { describe, expect, it, vi } from "vitest";
import { AccountId } from "@/lib/account-session";
import { customerMemoryFixture } from "@/lib/contracts";
import {
  createSupabaseCustomerMemoryPort,
  createSupabaseCustomerMemoryProjectionReader,
} from "./supabase-customer-memory-port";

const accountId = new AccountId("00000000-0000-4000-8000-000000000016");
const now = () => "2026-07-23T00:00:00.000Z";

describe("Supabase customer memory port", () => {
  it("reads an active safe projection through the injected account repository", async () => {
    const readProjection = vi.fn().mockResolvedValue({
      account_id: accountId.value,
      memory: customerMemoryFixture,
      expires_at: "2026-08-23T00:00:00.000Z",
    });
    const port = createSupabaseCustomerMemoryPort({ readProjection, now });

    await expect(port.getForAuthenticatedCustomer({
      accountId,
      purpose: "personalization",
    })).resolves.toEqual(customerMemoryFixture);
    expect(readProjection).toHaveBeenCalledWith(accountId);
  });

  it("denies a projection returned for another account", async () => {
    const port = createSupabaseCustomerMemoryPort({
      readProjection: vi.fn().mockResolvedValue({
        account_id: "00000000-0000-4000-8000-000000000099",
        memory: customerMemoryFixture,
        expires_at: null,
      }),
      now,
    });

    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "personalization" })).resolves.toBeNull();
  });

  it("fails closed for expired or malformed projection DTOs", async () => {
    const expired = createSupabaseCustomerMemoryPort({
      readProjection: vi.fn().mockResolvedValue({
        account_id: accountId.value,
        memory: customerMemoryFixture,
        expires_at: "2026-07-22T00:00:00.000Z",
      }),
      now,
    });
    const malformed = createSupabaseCustomerMemoryPort({
      readProjection: vi.fn().mockResolvedValue({
        account_id: accountId.value,
        memory: { rawNotes: "not allowed" },
        expires_at: null,
      }),
      now,
    });

    await expect(expired.getForAuthenticatedCustomer({ accountId, purpose: "personalization" })).resolves.toBeNull();
    await expect(malformed.getForAuthenticatedCustomer({ accountId, purpose: "personalization" })).resolves.toBeNull();
  });

  it("queries only safe projection columns by internal account without forwarding bearer material", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const readProjection = createSupabaseCustomerMemoryProjectionReader(fetcher);

    await expect(readProjection(accountId)).resolves.toBeNull();

    const [request, init] = fetcher.mock.calls[0] ?? [];
    expect(request).toBeInstanceOf(URL);
    const url = new URL(String(request));
    expect(url.searchParams.get("select")).toBe("account_id,memory,expires_at");
    expect(url.searchParams.get("account_id")).toBe(`eq.${accountId.value}`);
    expect(url.searchParams.has("user_id")).toBe(false);
    const headers = new Headers(init?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
  });

  it("keeps the disabled purpose off the repository and network", async () => {
    const readProjection = vi.fn();
    const fetcher = vi.fn<typeof fetch>();
    const port = createSupabaseCustomerMemoryPort({ readProjection, now });

    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "concierge" })).resolves.toBeNull();
    expect(readProjection).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
