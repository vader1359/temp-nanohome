const allowedCatalogHosts = new Set(["airtableusercontent.com", "res.cloudinary.com"]);

export function catalogFileUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    const hostAllowed = Array.from(allowedCatalogHosts).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && hostAllowed ? url.toString() : null;
  } catch {
    return null;
  }
}
