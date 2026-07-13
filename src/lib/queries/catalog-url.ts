import { env } from "@/lib/env";

const allowedCatalogHosts = new Set(["airtableusercontent.com", "res.cloudinary.com"]);
const supabaseOrigin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;

export function catalogFileUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const hostAllowed = Array.from(allowedCatalogHosts).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    const publicSupabaseStorageUrl = url.origin === supabaseOrigin && url.pathname.startsWith("/storage/v1/object/public/");
    return url.protocol === "https:" && url.username === "" && url.password === "" && (hostAllowed || publicSupabaseStorageUrl) ? url.toString() : null;
  } catch {
    return null;
  }
}
