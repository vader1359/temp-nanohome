import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { parseSignUpForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const credentials = parseSignUpForm(formData);

  if (!credentials.ok) {
    const error = credentials.error === "password_mismatch" || credentials.error === "terms_required"
      ? credentials.error
      : "sign_up_error";
    return NextResponse.redirect(new URL(`/${locale}?auth=${error}`, request.url));
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { error } = await supabase.auth.signUp({
    email: credentials.value.email,
    password: credentials.value.password,
    options: {
      emailRedirectTo: new URL(
        `/auth/callback?next=${encodeURIComponent(credentials.value.redirectTo)}`,
        request.url,
      ).toString(),
      data: {
        full_name: credentials.value.fullName,
        phone: credentials.value.phone,
      },
    },
  });

  if (error !== null) {
    return applyCookies(
      NextResponse.redirect(
        new URL(`/${credentials.value.locale}?auth=sign_up_error`, request.url),
      ),
    );
  }

  revalidatePath("/", "layout");
  return applyCookies(
    NextResponse.redirect(
      new URL(`/${credentials.value.locale}/check-email?signup=success`, request.url),
    ),
  );
}
