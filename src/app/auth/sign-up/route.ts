import { NextResponse, type NextRequest } from "next/server";

import { parseEmailPasswordForm } from "@/lib/auth/credentials";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const credentials = parseEmailPasswordForm(await request.formData());

  if (!credentials.ok) {
    return NextResponse.redirect(new URL("/vi?auth=invalid_credentials", request.url));
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
    },
  });

  if (error !== null) {
    return NextResponse.redirect(new URL("/vi?auth=sign_up_error", request.url));
  }

  return NextResponse.redirect(new URL(credentials.value.redirectTo, request.url));
}
