import "server-only";

import { supabaseEmailLinkRecoveryFetch } from "@/lib/remote-read-only";

const STATE_DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type EmailLinkRecoveryLedgerInspection = "expired" | "invalid" | "replayed" | "valid";
export type EmailLinkRecoveryLedgerConsumption = "consumed" | "expired" | "invalid" | "replayed";

export type EmailLinkRecoveryLedger = Readonly<{
  begin: (input: Readonly<{ expiresAt: number; stateDigest: string }>) => Promise<boolean>;
  consume: (stateDigest: string) => Promise<EmailLinkRecoveryLedgerConsumption>;
  inspect: (stateDigest: string) => Promise<EmailLinkRecoveryLedgerInspection>;
}>;

type LedgerRuntimeOptions = Readonly<{
  baseUrl: string;
  fetcher?: typeof fetch;
  serviceRoleKey: string;
}>;

function validStateDigest(value: string): boolean {
  return STATE_DIGEST_PATTERN.test(value);
}

function rpcUrl(baseUrl: string, functionName: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/rest/v1/rpc/${functionName}`;
}

async function callRpc(
  options: LedgerRuntimeOptions,
  functionName: string,
  body: Readonly<Record<string, string>>,
): Promise<unknown> {
  const response = await (options.fetcher ?? supabaseEmailLinkRecoveryFetch)(rpcUrl(options.baseUrl, functionName), {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error("Email-link recovery ledger is unavailable");
  return response.json();
}

function parseStatus<T extends string>(input: unknown, allowed: readonly T[]): T {
  if (typeof input !== "string" || !allowed.includes(input as T)) {
    throw new Error("Email-link recovery ledger returned an invalid response");
  }
  return input as T;
}

export function createEmailLinkRecoveryLedger(options: LedgerRuntimeOptions): EmailLinkRecoveryLedger {
  return {
    async begin(input) {
      if (!validStateDigest(input.stateDigest) || !Number.isInteger(input.expiresAt) || input.expiresAt <= 0) {
        throw new Error("Invalid email-link recovery ledger input");
      }
      const result = await callRpc(options, "begin_email_link_recovery_transaction", {
        p_expires_at: new Date(input.expiresAt * 1_000).toISOString(),
        p_state_digest: input.stateDigest,
      });
      if (typeof result !== "boolean") {
        throw new Error("Email-link recovery ledger returned an invalid response");
      }
      return result;
    },
    async consume(stateDigest) {
      if (!validStateDigest(stateDigest)) return "invalid";
      return parseStatus(
        await callRpc(options, "consume_email_link_recovery_transaction", { p_state_digest: stateDigest }),
        ["consumed", "expired", "invalid", "replayed"] as const,
      );
    },
    async inspect(stateDigest) {
      if (!validStateDigest(stateDigest)) return "invalid";
      return parseStatus(
        await callRpc(options, "inspect_email_link_recovery_transaction", { p_state_digest: stateDigest }),
        ["expired", "invalid", "replayed", "valid"] as const,
      );
    },
  };
}
