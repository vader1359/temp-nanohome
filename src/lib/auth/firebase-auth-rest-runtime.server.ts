import "server-only";

import { env } from "@/lib/env";
import { createFirebaseAuthRestClient } from "./firebase-auth-rest.server";

export function getFirebaseAuthRestClient() {
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey === undefined) throw new Error("Firebase public API key is unavailable");
  return createFirebaseAuthRestClient({ apiKey });
}
