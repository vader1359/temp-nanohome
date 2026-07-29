import { NextResponse, type NextRequest } from "next/server";

import { getFirebaseAuthRestClient } from "@/lib/auth/firebase-auth-rest-runtime.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { parseSignUpForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const credentials = parseSignUpForm(formData);
  if (!credentials.ok) {
    const error = credentials.error === "password_mismatch" || credentials.error === "terms_required"
      ? credentials.error
      : "sign_up_error";
    return NextResponse.redirect(new URL(`/${locale}?auth=${error}`, request.url), 303);
  }

  try {
    await getFirebaseAuthRestClient().signUpAndSendVerification(
      credentials.value.email,
      credentials.value.password,
      credentials.value.locale,
    );
    return NextResponse.redirect(
      new URL(`/${credentials.value.locale}/check-email?signup=success`, request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/${credentials.value.locale}?auth=sign_up_error`, request.url),
      303,
    );
  }
}
