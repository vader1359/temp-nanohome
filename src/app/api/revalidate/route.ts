import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { env } from "@/lib/env";
import { createRevalidationAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const revalidationEventSchema = z.object({
  eventId: z.string().uuid(),
  locale: z.enum(["en", "ko", "vi"]),
  published: z.boolean(),
  table: z.enum([
    "content_carousel_items",
    "content_carousels",
    "hero_hotspots",
    "hero_slides",
    "media_assets",
    "page_sections",
    "product_curation_items",
    "product_curations",
    "site_pages",
    "variants",
  ]),
}).strict();

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization");
  const expectedAuthorization = `Bearer ${env.REVALIDATE_SECRET}`;

  if (authorization === null || !hasMatchingAuthorization(authorization, expectedAuthorization)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = revalidationEventSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { error } = await createRevalidationAdminClient()
    .from("revalidation_webhook_events")
    .insert({ event_id: parsed.data.eventId });

  if (error !== null) {
    if (error.code === "23505") {
      return Response.json({ error: "Duplicate event" }, { status: 409 });
    }

    return Response.json({ error: "Unable to process event" }, { status: 500 });
  }

  if (!parsed.data.published) {
    return Response.json({ revalidated: false }, { status: 202 });
  }

  revalidateTag("homepage", "max");
  revalidateTag(`homepage:${parsed.data.locale}`, "max");

  return Response.json({ revalidated: true }, { status: 200 });
}

function hasMatchingAuthorization(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(receivedDigest, expectedDigest);
}
