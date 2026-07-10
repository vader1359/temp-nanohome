import { isSupportedLocale, type Locale, routing } from "@/i18n/routing";

const DEFAULT_REDIRECT_PATH = `/${routing.defaultLocale}`;

export function getSafeRedirectPath(value: string | null, fallbackLocale?: Locale): string {
  const fallbackPath = fallbackLocale === undefined ? DEFAULT_REDIRECT_PATH : `/${fallbackLocale}`;
  if (value === null || value === "" || !value.startsWith("/") || value.startsWith("//")) {
    return fallbackPath;
  }

  return getAuthRedirectPath(value);
}

export function getAuthRedirectPath(path: string): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.delete("auth");

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getSupportedLocale(value: string | null): Locale {
  if (value && isSupportedLocale(value)) {
    return value as Locale;
  }
  return routing.defaultLocale;
}

export function getRedirectLocale(path: string): Locale {
  const [firstSegment] = path.replace(/^\//, "").split("/");

  return getSupportedLocale(firstSegment ?? null);
}
