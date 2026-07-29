import { privateJson } from "../private-response";

/**
 * Retained as a fail-closed compatibility endpoint for stale clients.
 * Authentication now happens with the Firebase Web SDK and the verified
 * `/api/auth/session` ID-token exchange.
 */
export async function POST(): Promise<Response> {
  return privateJson({ error: "Authentication flow retired" }, 410);
}
