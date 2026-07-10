import { NextResponse, type NextRequest } from "next/server";

import { parseSignUpForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
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
    return NextResponse.redirect(new URL(`/${credentials.value.locale}?auth=sign_up_error`, request.url));
  }

  return NextResponse.redirect(new URL(`/${credentials.value.locale}?auth=register_success`, request.url));
}
