import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default function middleware(request: NextRequest) {
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
