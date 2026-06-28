import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { supabaseAmisSyncFetch, supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { Database, TypedSupabaseClient } from "@/types/db";

export function createAdminClient(): TypedSupabaseClient {
  return createAdminClientWithFetch(supabaseReadOnlyFetch);
}

export function createAmisSyncAdminClient(): TypedSupabaseClient {
  return createAdminClientWithFetch(supabaseAmisSyncFetch);
}

function createAdminClientWithFetch(customFetch: typeof fetch): TypedSupabaseClient {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: customFetch,
      },
    },
  );
}
