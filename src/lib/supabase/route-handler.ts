import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

import { env } from "@/lib/env";
import { supabaseReadOnlyFetch } from "@/lib/remote-read-only";
import type { Database } from "@/types/db";
import { sanitizeCookies } from "./cookie-sanitizer";

type PendingCookie = {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
};

/**
 * Supabase client for Route Handlers. Session cookies are buffered and must be
 * applied onto the returned NextResponse (redirect/next) so Set-Cookie lands.
 */
export function createRouteHandlerClient(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient<Database, "public", "public">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: supabaseReadOnlyFetch,
      },
      cookies: {
        getAll() {
          return sanitizeCookies(request.cookies.getAll());
        },
        setAll(cookiesToSet: PendingCookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
            request.cookies.set(name, value);
          });
        },
      },
    },
  );

  function applyCookies<T extends NextResponse>(response: T): T {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return { supabase, applyCookies };
}
