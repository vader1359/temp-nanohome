import { env } from "@/lib/env";

const allowedCatalogHosts = new Set(["airtableusercontent.com", "res.cloudinary.com"]);
const supabaseOrigin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
const mediaOrigin = env.NEXT_PUBLIC_MEDIA_URL ? new URL(env.NEXT_PUBLIC_MEDIA_URL).origin : null;

export function catalogFileUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const hostAllowed = Array.from(allowedCatalogHosts).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    const publicSupabaseStorageUrl = url.origin === supabaseOrigin && url.pathname.startsWith("/storage/v1/object/public/");
    const publicR2CatalogUrl = mediaOrigin !== null && url.origin === mediaOrigin && url.pathname.startsWith("/catalogs/");
    return url.protocol === "https:" && url.username === "" && url.password === "" && (hostAllowed || publicSupabaseStorageUrl || publicR2CatalogUrl) ? url.toString() : null;
  } catch {
    return null;
  }
}
