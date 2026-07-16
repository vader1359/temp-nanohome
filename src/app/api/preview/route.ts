import { createHmac, timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { z } from "zod";

import { env } from "@/lib/env";

export const runtime = "nodejs";

const previewQuerySchema = z.object({
  expiresAt: z.coerce.number().int().positive(),
  path: z.string(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = previewQuerySchema.safeParse({
    expiresAt: url.searchParams.get("expiresAt"),
    path: url.searchParams.get("path"),
    token: url.searchParams.get("token"),
  });

  if (!parsed.success || parsed.data.expiresAt <= Math.floor(Date.now() / 1000)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parsed.data.path !== "/") {
    return Response.json({ error: "Invalid preview path" }, { status: 400 });
  }

  const expectedToken = createHmac("sha256", env.PREVIEW_SECRET)
    .update(`${parsed.data.path}:${parsed.data.expiresAt}`)
    .digest("hex");

  if (!timingSafeEqual(Buffer.from(parsed.data.token), Buffer.from(expectedToken))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await draftMode();
  preview.enable();

  return Response.redirect(new URL(parsed.data.path, url), 307);
}
