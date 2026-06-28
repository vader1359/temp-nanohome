import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const redirectTo = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (code === null || code === "") {
    return NextResponse.redirect(new URL("/vi?auth=missing_code", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(new URL("/vi?auth=callback_error", request.url));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
