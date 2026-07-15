import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { supabaseCheckoutFetch } from "@/lib/remote-read-only";
import type { Database } from "@/types/db";
import { sanitizeCookies } from "./cookie-sanitizer";

export async function createCheckoutClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "public", "public">(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { fetch: supabaseCheckoutFetch },
      cookies: {
        getAll() {
          return sanitizeCookies(cookieStore.getAll());
        },
        setAll(cookiesToSet: { readonly name: string; readonly value: string; readonly options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
