import { env } from "@/lib/env";
import { runAmisSync } from "@/lib/amis/sync";

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAmisSync();
  return Response.json(result, { status: 200 });
}
