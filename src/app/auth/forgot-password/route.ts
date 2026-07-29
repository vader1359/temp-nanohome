import { NextResponse, type NextRequest } from "next/server";

import { getFirebaseAuthRestClient } from "@/lib/auth/firebase-auth-rest-runtime.server";
import { FirebaseAuthRestError } from "@/lib/auth/firebase-auth-rest.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { parseForgotPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const recovery = parseForgotPasswordForm(formData);
  if (!recovery.ok) {
    return NextResponse.redirect(new URL(`/${locale}?auth=forgot_error`, request.url), 303);
  }

  try {
    await getFirebaseAuthRestClient().sendPasswordReset(recovery.value.email, recovery.value.locale);
  } catch (error) {
    // Do not reveal whether an email exists.
    if (!(error instanceof FirebaseAuthRestError && error.code === "EMAIL_NOT_FOUND")) {
      return NextResponse.redirect(
        new URL(`/${recovery.value.locale}?auth=forgot_error`, request.url),
        303,
      );
    }
  }

  return NextResponse.redirect(
    new URL(`/${recovery.value.locale}?auth=forgot_sent`, request.url),
    303,
  );
}
