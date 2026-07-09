import { NextResponse, type NextRequest } from "next/server";

import { getRedirectLocale, getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const locale = getRedirectLocale(redirectTo);

  if (code === null || code === "") {
    return NextResponse.redirect(new URL(`/${locale}?auth=missing_code`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(new URL(`/${locale}?auth=callback_error`, request.url));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
