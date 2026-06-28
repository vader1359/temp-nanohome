import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const redirectValue = formData.get("redirectTo");
  const redirectTo = getSafeRedirectPath(
    typeof redirectValue === "string" ? redirectValue : null,
  );
  const supabase = await createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
