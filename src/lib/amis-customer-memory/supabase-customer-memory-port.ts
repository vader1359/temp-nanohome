import "server-only";

import { z } from "zod";
import type { AccountId } from "@/lib/account-session";
import type { CustomerMemoryPort } from "@/lib/contracts";
import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import { customerMemorySchema } from "@/lib/contracts";

const projectionSchema = z.object({
  account_id: z.string().uuid(),
  memory: z.unknown(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
}).strict();

export type CustomerMemoryProjectionReader = (
  accountId: AccountId,
) => Promise<unknown>;

export function createSupabaseCustomerMemoryProjectionReader(
  fetcher: typeof fetch = supabaseReadOnlyFetch,
): CustomerMemoryProjectionReader {
  return async (accountId) => {
    const url = new URL("/rest/v1/customer_memory_projections", env.NEXT_PUBLIC_SUPABASE_URL);
    url.searchParams.set("select", "account_id,memory,expires_at");
    url.searchParams.set("account_id", `eq.${accountId.value}`);
    url.searchParams.set("order", "updated_at.desc");
    url.searchParams.set("limit", "1");
    const response = await fetcher(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    return Array.isArray(rows) ? (rows[0] ?? null) : null;
  };
}

type SupabaseCustomerMemoryPortOptions = Readonly<{
  readProjection: CustomerMemoryProjectionReader;
  now?: () => string;
}>;

export function createSupabaseCustomerMemoryPort(
  options: SupabaseCustomerMemoryPortOptions,
): CustomerMemoryPort {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    getForAuthenticatedCustomer: async ({ accountId, purpose }) => {
      if (purpose !== "personalization") return null;

      try {
        const parsed = projectionSchema.safeParse(await options.readProjection(accountId));
        if (!parsed.success || parsed.data.account_id !== accountId.value) return null;
        if (parsed.data.expires_at !== null && Date.parse(parsed.data.expires_at) <= Date.parse(now())) {
          return null;
        }

        const memory = customerMemorySchema.safeParse(parsed.data.memory);
        return memory.success ? memory.data : null;
      } catch (error) {
        if (error instanceof Error) return null;
        throw error;
      }
    },
  };
}
