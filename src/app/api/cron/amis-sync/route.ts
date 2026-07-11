import { env } from "@/lib/env";
import { runAmisSync } from "@/lib/amis/sync";

export async function GET(request: Request): Promise<Response> {
  return handleAmisSyncCron(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleAmisSyncCron(request);
}

async function handleAmisSyncCron(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAmisSync();
  return Response.json({
    status: result.status,
    itemsProcessed: result.itemsProcessed,
    itemsFailed: result.itemsFailed,
    error: result.error === null ? null : "AMIS sync failed",
    watermark: result.watermark,
  }, { status: 200 });
}
