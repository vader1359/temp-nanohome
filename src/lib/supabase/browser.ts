import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { Database } from "@/types/db";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: supabaseReadOnlyFetch,
      },
    },
  );
}
