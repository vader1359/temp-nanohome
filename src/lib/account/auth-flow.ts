import type { Locale } from "@/i18n/routing";

export function safeAccountReturnTo(locale: Locale, candidate: string | undefined): string {
  if (
    candidate === undefined
    || candidate.includes("\\")
    || candidate.includes("\u0000")
    || /%00/iu.test(candidate)
    || !candidate.startsWith(`/${locale}`)
  ) return `/${locale}`;
  const boundary = candidate.charAt(locale.length + 1);
  if (boundary !== "" && boundary !== "/" && boundary !== "?") return `/${locale}`;

  try {
    const url = new URL(candidate, "https://account.local");
    if (url.origin !== "https://account.local" || url.username !== "" || url.password !== "") {
      return `/${locale}`;
    }
    url.searchParams.delete("auth");
    const search = url.searchParams.toString();
    return `${url.pathname}${search === "" ? "" : `?${search}`}`;
  } catch {
    return `/${locale}`;
  }
}
