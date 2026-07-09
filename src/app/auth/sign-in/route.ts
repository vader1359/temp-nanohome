import { NextResponse, type NextRequest } from "next/server";

import { parseEmailPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const credentials = parseEmailPasswordForm(formData);

  if (!credentials.ok) {
    return NextResponse.redirect(new URL(`/${locale}?auth=invalid_credentials`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.value.email,
    password: credentials.value.password,
  });

  if (error !== null) {
    return NextResponse.redirect(new URL(`/${credentials.value.locale}?auth=sign_in_error`, request.url));
  }

  return NextResponse.redirect(new URL(credentials.value.redirectTo, request.url));
}
