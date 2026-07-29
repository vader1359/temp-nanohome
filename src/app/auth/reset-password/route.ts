import { NextResponse, type NextRequest } from "next/server";

import { getFirebaseAuthRestClient } from "@/lib/auth/firebase-auth-rest-runtime.server";
import { FirebaseAuthRestError } from "@/lib/auth/firebase-auth-rest.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { parseResetPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const reset = parseResetPasswordForm(formData);
  if (!reset.ok) {
    return NextResponse.redirect(new URL(`/${locale}/reset-password?status=validation`, request.url), 303);
  }

  try {
    await getFirebaseAuthRestClient().confirmPasswordReset(reset.value.oobCode, reset.value.password);
    return NextResponse.redirect(new URL(reset.value.redirectTo, request.url), 303);
  } catch (error) {
    const status = error instanceof FirebaseAuthRestError
      && ["EXPIRED_OOB_CODE", "INVALID_OOB_CODE"].includes(error.code)
      ? "invalid"
      : "error";
    return NextResponse.redirect(
      new URL(`/${reset.value.locale}/reset-password?status=${status}`, request.url),
      303,
    );
  }
}
