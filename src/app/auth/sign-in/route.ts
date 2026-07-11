import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { parseEmailPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const credentials = parseEmailPasswordForm(formData);

  if (!credentials.ok) {
    return NextResponse.redirect(new URL(`/${locale}?auth=invalid_credentials`, request.url));
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.value.email,
    password: credentials.value.password,
  });

  if (error !== null) {
    if (error.code === "invalid_credentials") {
      return applyCookies(
        NextResponse.redirect(
          new URL(`/${credentials.value.locale}?auth=invalid_credentials`, request.url),
        ),
      );
    }

    if (error.code === "email_not_confirmed") {
      return applyCookies(
        NextResponse.redirect(
          new URL(`/${credentials.value.locale}?auth=email_not_confirmed`, request.url),
        ),
      );
    }

    return applyCookies(
      NextResponse.redirect(
        new URL(`/${credentials.value.locale}?auth=sign_in_error`, request.url),
      ),
    );
  }

  revalidatePath("/", "layout");
  return applyCookies(
    NextResponse.redirect(new URL(credentials.value.redirectTo, request.url)),
  );
}
