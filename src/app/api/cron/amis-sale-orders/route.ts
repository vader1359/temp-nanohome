import { runAmisSaleOrderDelta } from "@/lib/amis/inventory-sync";
import { env } from "@/lib/env";

export async function GET(request: Request): Promise<Response> { return handle(request); }
export async function POST(request: Request): Promise<Response> { return handle(request); }

async function handle(request: Request): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(safeResult(await runAmisSaleOrderDelta()));
}

function safeResult(result: Awaited<ReturnType<typeof runAmisSaleOrderDelta>>) {
  return {
    status: result.status,
    itemsProcessed: result.itemsProcessed,
    error: result.status === "failed" ? "AMIS inventory sync failed" : null,
  };
}
