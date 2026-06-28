import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { env } from "./lib/env";
import { supabaseReadOnlyFetch } from "./lib/remote-read-only";
import type { Database } from "./types/db";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  const supabase = createServerClient<Database, "public", "public">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: supabaseReadOnlyFetch,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Match all pathnames except for:
  // - _next (internal files)
  // - auth (handled by auth flow separately)
  // - api (API routes)
  // - static files (contain a dot in path)
  matcher: ["/((?!_next|auth|api|.*\\..*).*)"],
};
