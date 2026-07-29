import { NextResponse, type NextRequest } from "next/server";

import { getRedirectLocale, getSafeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const redirectTo = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const locale = getRedirectLocale(redirectTo);
  const mode = requestUrl.searchParams.get("mode");
  const oobCode = requestUrl.searchParams.get("oobCode");

  if (mode === "resetPassword" && oobCode) {
    const target = new URL(`/${locale}/reset-password`, request.url);
    target.searchParams.set("oobCode", oobCode);
    return NextResponse.redirect(target, 303);
  }

  // Firebase-hosted email actions remain authoritative. This route only
  // handles a future safe return and never exchanges a Supabase auth code.
  if (mode === "verifyEmail" && oobCode) {
    return NextResponse.redirect(new URL(`/${locale}?auth=login`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/${locale}?auth=missing_code`, request.url), 303);
}
