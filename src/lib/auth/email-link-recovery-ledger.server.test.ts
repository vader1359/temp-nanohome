import { describe, expect, it, vi } from "vitest";

import { createEmailLinkRecoveryLedger } from "./email-link-recovery-ledger.server";

const stateDigest = "d".repeat(43);

describe("email-link recovery ledger", () => {
  it("starts a transaction through the dedicated service-role RPC", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(true));
    const ledger = createEmailLinkRecoveryLedger({
      baseUrl: "https://project.supabase.co/",
      fetcher,
      serviceRoleKey: "service-role-test",
    });

    await expect(ledger.begin({ expiresAt: 2_000_000_600, stateDigest })).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/begin_email_link_recovery_transaction",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      p_expires_at: "2033-05-18T03:43:20.000Z",
      p_state_digest: stateDigest,
    });
    expect(init?.headers).toMatchObject({
      apikey: "service-role-test",
      Authorization: "Bearer service-role-test",
    });
  });

  it("parses inspect and atomic-consume statuses", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json("valid"))
      .mockResolvedValueOnce(Response.json("consumed"))
      .mockResolvedValueOnce(Response.json("replayed"));
    const ledger = createEmailLinkRecoveryLedger({
      baseUrl: "https://project.supabase.co",
      fetcher,
      serviceRoleKey: "service-role-test",
    });

    await expect(ledger.inspect(stateDigest)).resolves.toBe("valid");
    await expect(ledger.consume(stateDigest)).resolves.toBe("consumed");
    await expect(ledger.consume(stateDigest)).resolves.toBe("replayed");
  });

  it("fails closed for malformed input and invalid upstream responses", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ unexpected: true }));
    const ledger = createEmailLinkRecoveryLedger({
      baseUrl: "https://project.supabase.co",
      fetcher,
      serviceRoleKey: "service-role-test",
    });

    await expect(ledger.inspect("invalid")).resolves.toBe("invalid");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(ledger.inspect(stateDigest)).rejects.toThrow("invalid response");
  });
});
