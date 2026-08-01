import { createFirebaseAdminAuth } from "@/lib/auth/firebase-admin.server";
import { createEmailLinkRecoveryLedger } from "@/lib/auth/email-link-recovery-ledger.server";
import { createEmailLinkRecoveryRouteHandlers } from "@/lib/auth/email-link-recovery-route.server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handlers() {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  if (projectId === undefined) throw new Error("Firebase Admin project is unavailable");
  return createEmailLinkRecoveryRouteHandlers({
    auth: createFirebaseAdminAuth({
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
      projectId,
    }),
    ledger: createEmailLinkRecoveryLedger({
      baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    }),
    nowSeconds: () => Math.floor(Date.now() / 1_000),
    secret: env.AUTH_CSRF_SECRET,
  });
}

export async function GET(request: Parameters<ReturnType<typeof handlers>["GET"]>[0]) {
  return handlers().GET(request);
}

export async function POST(request: Parameters<ReturnType<typeof handlers>["POST"]>[0]) {
  return handlers().POST(request);
}

export async function PUT(request: Parameters<ReturnType<typeof handlers>["PUT"]>[0]) {
  return handlers().PUT(request);
}
