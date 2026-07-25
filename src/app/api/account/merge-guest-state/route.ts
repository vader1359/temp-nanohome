import { NextResponse } from "next/server";

import { getAccountAuthPort, getAccountWishlistPort } from "@/lib/account/account-ports.server";
import { parseGuestWishlistMerge } from "@/lib/account/wishlist-schema";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

function privateJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

export async function POST(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Content-Type must be application/json" }, 415);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return privateJson({ error: "Malformed JSON" }, 400);
    throw error;
  }
  const input = parseGuestWishlistMerge(body);
  if (input === null) return privateJson({ error: "A bounded canonical guest wishlist is required" }, 422);
  const items = await getAccountWishlistPort().mergeGuestItems(account, input);
  return privateJson({ items }, 200);
}
