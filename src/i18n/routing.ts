import { defineRouting } from "next-intl/routing";

export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "vi",
  localePrefix: "always",
  localeDetection: false,
});

export function isSupportedLocale(locale: string | undefined): locale is Locale {
  return locale !== undefined && routing.locales.some((supported) => supported === locale);
}
