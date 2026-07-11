import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getRedirectLocale, getSafeRedirectPath } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const locale = getRedirectLocale(redirectTo);

  if (code === null || code === "") {
    return NextResponse.redirect(new URL(`/${locale}?auth=missing_code`, request.url));
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    if (redirectTo.endsWith("/reset-password")) {
      return applyCookies(
        NextResponse.redirect(new URL(`${redirectTo}?status=invalid`, request.url)),
      );
    }

    return applyCookies(
      NextResponse.redirect(new URL(`/${locale}?auth=callback_error`, request.url)),
    );
  }

  revalidatePath("/", "layout");
  return applyCookies(NextResponse.redirect(new URL(redirectTo, request.url)));
}
