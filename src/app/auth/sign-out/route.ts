import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { clearFirebaseSessionCookie } from "@/lib/auth/firebase-session.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { getSafeRedirectPath, getSupportedLocale } from "@/lib/auth/redirect";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) return new NextResponse(null, { status: 403 });
  const formData = await request.formData();
  const redirectValue = formData.get("redirectTo");
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const redirectTo = getSafeRedirectPath(
    typeof redirectValue === "string" ? redirectValue : null,
    locale,
  );

  revalidatePath("/", "layout");
  return clearFirebaseSessionCookie(
    NextResponse.redirect(new URL(redirectTo, request.url), 303),
  );
}
