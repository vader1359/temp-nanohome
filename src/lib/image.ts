interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: number | string;
  format?: string;
}

const CLOUDINARY_HOSTNAME = "res.cloudinary.com";
const CLOUDINARY_CLOUD_NAME = "nanohome-web";
const R2_PUBLIC_MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/+$/, "");

export function cloudinaryUrl(src: string, opts: CloudinaryOptions = {}): string {
  if (isCloudinaryUrl(src)) {
    return src;
  }

  if (!src.startsWith("http") && !src.startsWith("/")) {
    const transformations: string[] = [];
    if (opts.width) transformations.push(`w_${opts.width}`);
    if (opts.height) transformations.push(`h_${opts.height}`);
    if (opts.quality) transformations.push(`q_${opts.quality}`);
    if (opts.format) transformations.push(`f_${opts.format}`);

    const transformPath = transformations.length > 0 ? transformations.join(",") + "/" : "";
    return `https://${CLOUDINARY_HOSTNAME}/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformPath}${src}`;
  }

  return placeholderUrl();
}

export function isCloudinaryUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === CLOUDINARY_HOSTNAME && url.pathname.startsWith(`/${CLOUDINARY_CLOUD_NAME}/`);
  } catch {
    return false;
  }
}

export function isR2PublicMediaUrl(src: string): boolean {
  if (!R2_PUBLIC_MEDIA_URL) return false;

  try {
    const candidate = new URL(src);
    const base = new URL(R2_PUBLIC_MEDIA_URL);
    return candidate.protocol === "https:" && candidate.origin === base.origin && candidate.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
}

/**
 * Resolves the currently supported product image sources. Cloudinary asset IDs
 * remain supported while media is migrated, while absolute R2 public URLs are
 * returned unchanged.
 */
export function productImageUrl(src: string, opts: CloudinaryOptions = {}): string {
  if (isR2PublicMediaUrl(src)) return src;
  return cloudinaryUrl(src, opts);
}

export function firstProductImage(sources: readonly (string | null | undefined)[]): string {
  for (const source of sources) {
    if (typeof source !== "string" || source.length === 0) continue;
    const url = productImageUrl(source);
    if (isCloudinaryUrl(url) || isR2PublicMediaUrl(url)) return url;
  }

  return placeholderUrl();
}

// Retained for existing callers during the staged Cloudinary-to-R2 migration.
export const firstCloudinaryImage = firstProductImage;

export function placeholderUrl(): string {
  return "/images/placeholder.webp";
}
