const DEFAULT_REDIRECT_PATH = "/vi";

export function getSafeRedirectPath(value: string | null): string {
  if (value === null || value === "" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT_PATH;
  }

  return value;
}
