import { env } from "@/lib/env";
import { redactError, runInstagramSync } from "@/lib/instagram-sync";

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
  if (result.status === "error") {
    // Keep the HTTP response generic while retaining a redacted diagnostic in
    // server logs, even if an implementation returns an unredacted message.
    console.error("Instagram sync failed:", redactError(result.error));
  }
  return Response.json({
    status: result.status,
    processedCount: result.processedCount,
    readyCount: result.readyCount,
    error: result.status === "error" ? "Instagram sync failed" : null,
  }, { status: 200 });
}
