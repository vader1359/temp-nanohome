import { NextResponse } from "next/server";

import { getAccountAuthPort, getAccountCartPort } from "@/lib/account/account-ports.server";
import { parseGuestCartMerge } from "@/lib/account/cart-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } as const;
function privateJson(body: unknown, status: number): NextResponse { return NextResponse.json(body, { headers: privateHeaders, status }); }
async function parseRequest(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch (error: unknown) { if (error instanceof SyntaxError) return null; throw error; }
}
export async function POST(request: Request): Promise<NextResponse> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseGuestCartMerge(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid guest cart merge is required" }, 422);
  return privateJson({ cart: await getAccountCartPort().mergeGuestCart(account, input) }, 200);
}
