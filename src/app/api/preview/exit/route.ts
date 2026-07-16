import { draftMode } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const preview = await draftMode();
  preview.disable();

  return Response.redirect(new URL("/", request.url), 307);
}
