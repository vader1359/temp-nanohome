import { NextResponse } from "next/server";

import { getAccountAuthPort, getAccountCartPort } from "@/lib/account/account-ports.server";
import { parseCartMutation, parseCartRemoval } from "@/lib/account/cart-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } as const;

function privateJson(body: unknown, status: number): NextResponse { return NextResponse.json(body, { headers: privateHeaders, status }); }
async function parseRequest(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch (error: unknown) { if (error instanceof SyntaxError) return null; throw error; }
}
function resultJson(result: Awaited<ReturnType<ReturnType<typeof getAccountCartPort>["addItem"]>>): NextResponse {
  return result.status === "version_conflict" ? privateJson({ cart: result.cart, error: "version_conflict" }, 409) : privateJson({ cart: result.cart }, 200);
}
export async function GET(): Promise<NextResponse> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  return privateJson({ cart: await getAccountCartPort().getCart(account) }, 200);
}
export async function POST(request: Request): Promise<NextResponse> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartMutation(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart mutation is required" }, 422);
  return resultJson(await getAccountCartPort().addItem(account, input));
}
export async function PATCH(request: Request): Promise<NextResponse> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartMutation(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart mutation is required" }, 422);
  return resultJson(await getAccountCartPort().updateItem(account, input));
}
export async function DELETE(request: Request): Promise<NextResponse> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartRemoval(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart removal is required" }, 422);
  return resultJson(await getAccountCartPort().removeItem(account, input));
}
