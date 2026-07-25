import { NextResponse } from "next/server";

import { getAccountAuthPort, getAccountWishlistPort } from "@/lib/account/account-ports.server";
import { parseWishlistItem } from "@/lib/account/wishlist-schema";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

function privateJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

async function parseRequest(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function GET() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const items = await getAccountWishlistPort().getItems(account);
  return privateJson({ items }, 200);
}

export async function POST(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const body = await parseRequest(request);
  if (body === null) return privateJson({ error: "A valid JSON wishlist item is required" }, 422);
  const input = parseWishlistItem(body);
  if (input === null) return privateJson({ error: "A canonical variant id is required" }, 422);
  const items = await getAccountWishlistPort().addItem(account, input.variantId);
  return privateJson({ items }, 200);
}

export async function DELETE(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const body = await parseRequest(request);
  if (body === null) return privateJson({ error: "A valid JSON wishlist item is required" }, 422);
  const input = parseWishlistItem(body);
  if (input === null) return privateJson({ error: "A canonical variant id is required" }, 422);
  const items = await getAccountWishlistPort().removeItem(account, input.variantId);
  return privateJson({ items }, 200);
}
