import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/ca-performance" || request.nextUrl.pathname === "/ca-performance/") {
    const token = process.env.CA_PERFORMANCE_AUTH_TOKEN ?? "nanoCAp3rf";
    if (request.cookies.get("ca-performance-auth")?.value !== token) {
      return NextResponse.next({ request: { headers: new Headers({ "x-ca-performance-auth": "required" }) } });
    }
    return NextResponse.next({ request: { headers: new Headers({ "x-ca-performance-auth": "granted" }) } });
  }
  return handleI18nRouting(request);
}

export const config = {
  // Match all pathnames except for:
  // - _next (internal files)
  // - auth (handled by auth flow separately)
  // - api (API routes)
  // - static files (contain a dot in path)
  matcher: ["/((?!_next|auth|api|.*\\..*).*)"],
};
