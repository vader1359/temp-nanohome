import { env } from "@/lib/env";
import { runInstagramSync } from "@/lib/instagram-sync";

export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  return handleInstagramSyncCron(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleInstagramSyncCron(request);
}

async function handleInstagramSyncCron(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runInstagramSync();
  return Response.json({
    status: result.status,
    processedCount: result.processedCount,
    readyCount: result.readyCount,
    error: result.status === "error" ? "Instagram sync failed" : null,
  }, { status: 200 });
}
