import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { parseResetPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const reset = parseResetPasswordForm(formData);

  if (!reset.ok) {
    return NextResponse.redirect(new URL(`/${locale}/reset-password?status=validation`, request.url));
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { error } = await supabase.auth.updateUser({ password: reset.value.password });

  if (error !== null) {
    if (isAuthSessionMissingError(error)) {
      return applyCookies(
        NextResponse.redirect(
          new URL(`/${reset.value.locale}/reset-password?status=invalid`, request.url),
        ),
      );
    }

    return applyCookies(
      NextResponse.redirect(
        new URL(`/${reset.value.locale}/reset-password?status=error`, request.url),
      ),
    );
  }

  revalidatePath("/", "layout");
  return applyCookies(
    NextResponse.redirect(new URL(reset.value.redirectTo, request.url)),
  );
}
