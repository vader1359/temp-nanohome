import { NextResponse, type NextRequest } from "next/server";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { parseResetPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const reset = parseResetPasswordForm(formData);

  if (!reset.ok) {
    return NextResponse.redirect(new URL(`/${locale}/reset-password?status=validation`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: reset.value.password });

  if (error !== null) {
    if (isAuthSessionMissingError(error)) {
      return NextResponse.redirect(new URL(`/${reset.value.locale}/reset-password?status=invalid`, request.url));
    }

    return NextResponse.redirect(new URL(`/${reset.value.locale}/reset-password?status=error`, request.url));
  }

  return NextResponse.redirect(new URL(reset.value.redirectTo, request.url));
}
