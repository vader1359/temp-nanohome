import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { getSafeRedirectPath, getSupportedLocale } from "@/lib/auth/redirect";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectValue = formData.get("redirectTo");
  const locale = getSupportedLocale(formData.get("locale")?.toString() ?? null);
  const redirectTo = getSafeRedirectPath(
    typeof redirectValue === "string" ? redirectValue : null,
    locale,
  );
  const { supabase, applyCookies } = createRouteHandlerClient(request);

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  return applyCookies(NextResponse.redirect(new URL(redirectTo, request.url)));
}
