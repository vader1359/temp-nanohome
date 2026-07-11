import { NextResponse, type NextRequest } from "next/server";

import { parseForgotPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const recovery = parseForgotPasswordForm(formData);

  if (!recovery.ok) {
    return NextResponse.redirect(new URL(`/${locale}?auth=forgot_error`, request.url));
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { error } = await supabase.auth.resetPasswordForEmail(recovery.value.email, {
    redirectTo: new URL(
      `/auth/callback?next=${encodeURIComponent(recovery.value.redirectTo)}`,
      request.url,
    ).toString(),
  });

  if (error !== null) {
    return applyCookies(
      NextResponse.redirect(
        new URL(`/${recovery.value.locale}?auth=forgot_error`, request.url),
      ),
    );
  }

  return applyCookies(
    NextResponse.redirect(
      new URL(`/${recovery.value.locale}?auth=forgot_sent`, request.url),
    ),
  );
}
