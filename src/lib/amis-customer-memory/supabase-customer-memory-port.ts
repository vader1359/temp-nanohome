import "server-only";

import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { CustomerMemoryPort } from "@/lib/contracts";
import { customerMemorySchema } from "@/lib/contracts";

const projectionRowsSchema = z.array(z.object({
  memory: z.unknown(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
}).strip());

type SupabaseCustomerMemoryPortOptions = {
  readonly accessToken: string;
  readonly baseUrl?: string;
  readonly publishableKey?: string;
  readonly fetcher?: typeof fetch;
  readonly now?: () => string;
};

/**
 * Reads only the customer-owned safe projection created by Plan 03.
 * The caller supplies the authenticated access token so Supabase RLS remains
 * the final account-isolation boundary. Raw AMIS snapshots and notes are never
 * selected by this adapter.
 */
export function createSupabaseCustomerMemoryPort(
  options: SupabaseCustomerMemoryPortOptions,
): CustomerMemoryPort {
  const baseUrl = options.baseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = options.publishableKey ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const fetcher = options.fetcher ?? supabaseReadOnlyFetch;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    getForAuthenticatedCustomer: async ({ userId, purpose }) => {
      if (purpose !== "personalization" || options.accessToken.length === 0) {
        return null;
      }

      const url = new URL("/rest/v1/customer_memory_projections", baseUrl);
      url.searchParams.set("select", "memory,expires_at");
      url.searchParams.set("user_id", `eq.${userId}`);
      url.searchParams.set("order", "updated_at.desc");
      url.searchParams.set("limit", "1");

      try {
        const response = await fetcher(url, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            apikey: publishableKey,
            Authorization: `Bearer ${options.accessToken}`,
          },
        });
        if (!response.ok) return null;

        const rows = projectionRowsSchema.safeParse(await response.json());
        if (!rows.success || rows.data.length === 0) return null;
        const row = rows.data[0];
        if (row.expires_at !== null && Date.parse(row.expires_at) <= Date.parse(now())) {
          return null;
        }

        const memory = customerMemorySchema.safeParse(row.memory);
        return memory.success ? memory.data : null;
      } catch {
        return null;
      }
    },
  };
}
