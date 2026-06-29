interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: number | string;
  format?: string;
}

const CLOUDINARY_HOSTNAME = "res.cloudinary.com";
const CLOUDINARY_CLOUD_NAME = "nanohome-web";

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

export function firstCloudinaryImage(sources: readonly (string | null | undefined)[]): string {
  for (const source of sources) {
    if (typeof source !== "string" || source.length === 0) continue;
    const url = cloudinaryUrl(source);
    if (isCloudinaryUrl(url)) return url;
  }

  return placeholderUrl();
}

export function placeholderUrl(): string {
  return "/images/placeholder.webp";
}
