import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { supabaseAmisSyncFetch, supabaseReadOnlyFetch, supabaseInstagramSyncFetch } from "@/lib/remote-read-only";
import type { Database, TypedSupabaseClient } from "@/types/db";

export function createAdminClient(): TypedSupabaseClient {
  return createAdminClientWithFetch(supabaseReadOnlyFetch);
}

export function createAmisSyncAdminClient(): TypedSupabaseClient {
  return createAdminClientWithFetch(supabaseAmisSyncFetch);
}

export function createInstagramSyncAdminClient(signal?: AbortSignal): TypedSupabaseClient {
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
    }
    let fetchSignal = init?.signal;
    if (signal) {
      if (init?.signal) {
        if (typeof AbortSignal.any === "function") {
          fetchSignal = AbortSignal.any([signal, init.signal]);
        } else {
          // Fallback if AbortSignal.any is not defined (e.g. older JS environment or mock issues)
          const controller = new AbortController();
          const onAbort = () => {
            controller.abort(signal.reason ?? init.signal?.reason ?? new DOMException("The operation was aborted.", "AbortError"));
          };
          if (signal.aborted) {
            onAbort();
          } else if (init.signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener("abort", onAbort);
            init.signal.addEventListener("abort", onAbort);
          }
          fetchSignal = controller.signal;
        }
      } else {
        fetchSignal = signal;
      }
    }
    // The local PostgREST bridge is intentionally mounted at its root, while
    // supabase-js normally prefixes requests with /rest/v1.
    const requestUrl = new URL(input instanceof Request ? input.url : String(input));
    if (requestUrl.hostname === "127.0.0.1" && requestUrl.port === "54321" && requestUrl.pathname.startsWith("/rest/v1/")) {
      requestUrl.pathname = requestUrl.pathname.slice("/rest/v1".length);
    }
    return supabaseInstagramSyncFetch(requestUrl, {
      ...init,
      signal: fetchSignal,
    });
  };
  return createAdminClientWithFetch(customFetch);
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
