import { ZodError } from "zod";

import { parseAccountAuthFlowRequest } from "@/lib/account/auth-flow";
import { getAccountAuthFlowPort } from "@/lib/account/auth-flow-ports.server";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } as const;

function privateJson(body: unknown, status: number): Response {
  return Response.json(body, { headers: privateHeaders, status });
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Invalid request" }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid request" }, 400);
  }

  try {
    return privateJson(await getAccountAuthFlowPort().submit(parseAccountAuthFlowRequest(body)), 200);
  } catch (error: unknown) {
    if (error instanceof ZodError) return privateJson({ error: "Invalid request" }, 422);
    throw error;
  }
}
