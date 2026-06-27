interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: number | string;
  format?: string;
}

export function cloudinaryUrl(src: string, opts: CloudinaryOptions = {}): string {
  if (!src.startsWith("http") && !src.startsWith("/")) {
    // Treat as Cloudinary public ID
    const transformations: string[] = [];
    if (opts.width) transformations.push(`w_${opts.width}`);
    if (opts.height) transformations.push(`h_${opts.height}`);
    if (opts.quality) transformations.push(`q_${opts.quality}`);
    if (opts.format) transformations.push(`f_${opts.format}`);

    const transformPath = transformations.length > 0 ? transformations.join(",") + "/" : "";
    return `https://res.cloudinary.com/nanohome-web/image/upload/${transformPath}${src}`;
  }
  return src;
}

export function placeholderUrl(): string {
  return "/images/placeholder.webp";
}
