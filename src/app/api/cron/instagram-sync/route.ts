import { env } from "@/lib/env";
import { runInstagramSync } from "@/lib/instagram/sync";

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runInstagramSync();
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}

export const POST = GET;
