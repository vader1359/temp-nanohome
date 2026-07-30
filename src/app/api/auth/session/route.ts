import { createFirebaseAdminAuth } from "@/lib/auth/firebase-admin.server";
import { createFirebaseSessionRouteHandlers } from "@/lib/auth/firebase-session-route.server";
import { getAccountIdentityResolver } from "@/lib/account/account-ports.server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handlers() {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  if (projectId === undefined) throw new Error("Firebase Admin project is unavailable");
  const auth = createFirebaseAdminAuth({
    projectId,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
  });
  return createFirebaseSessionRouteHandlers({
    auth,
    nowSeconds: () => Math.floor(Date.now() / 1_000),
    projectId,
    sessionTtlSeconds: env.AUTH_SESSION_TTL_SECONDS ?? 432_000,
    resolveAccount: (input) => getAccountIdentityResolver().resolveOrCreate(input),
  });
}

export async function GET() {
  return handlers().GET();
}

export async function POST(request: Parameters<ReturnType<typeof handlers>["POST"]>[0]) {
  return handlers().POST(request);
}
