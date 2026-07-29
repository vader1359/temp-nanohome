import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getFirebaseAuthRestClient } from "@/lib/auth/firebase-auth-rest-runtime.server";
import { FirebaseAuthRestError } from "@/lib/auth/firebase-auth-rest.server";
import { FirebaseSessionExchangeError } from "@/lib/auth/firebase-session-exchange.server";
import {
  applyFirebaseSessionCookie,
  issueFirebaseSessionCookie,
} from "@/lib/auth/firebase-session.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { parseEmailPasswordForm } from "@/lib/auth/credentials";
import { getSupportedLocale } from "@/lib/auth/redirect";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const formData = await request.formData();
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const credentials = parseEmailPasswordForm(formData);
  if (!credentials.ok) {
    return NextResponse.redirect(new URL(`/${locale}?auth=invalid_credentials`, request.url), 303);
  }

  try {
    const idToken = await getFirebaseAuthRestClient().signInWithPassword(
      credentials.value.email,
      credentials.value.password,
    );
    const session = await issueFirebaseSessionCookie(idToken);
    revalidatePath("/", "layout");
    return applyFirebaseSessionCookie(
      NextResponse.redirect(new URL(credentials.value.redirectTo, request.url), 303),
      session,
    );
  } catch (error) {
    const authState = error instanceof FirebaseSessionExchangeError && error.code === "unverified_email"
      ? "email_not_confirmed"
      : error instanceof FirebaseAuthRestError
        && ["EMAIL_NOT_FOUND", "INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "USER_DISABLED"].includes(error.code)
        ? "invalid_credentials"
        : "sign_in_error";
    return NextResponse.redirect(new URL(`/${locale}?auth=${authState}`, request.url), 303);
  }
}
