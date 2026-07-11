import type { Locale } from "@/i18n/routing";

type LocalizedValue = string | null | undefined;
type LocalizedArrayValue = readonly string[] | null | undefined;

export type LocalizedText = Readonly<{
  en: LocalizedValue;
  ko: LocalizedValue;
  vi: LocalizedValue;
}>;

export type LocalizedArray = Readonly<{
  en: LocalizedArrayValue;
  ko: LocalizedArrayValue;
  vi: LocalizedArrayValue;
}>;

function nonBlank(value: LocalizedValue): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nonEmpty(values: LocalizedArrayValue): readonly string[] | null {
  return values !== null && values !== undefined && values.length > 0 ? values : null;
}

export function localizedText(content: LocalizedText, locale: Locale, fallback = ""): string {
  const candidates = locale === "ko"
    ? [content.ko, content.vi, content.en]
    : locale === "vi"
      ? [content.vi, content.en, content.ko]
      : [content.en, content.vi, content.ko];

  for (const candidate of candidates) {
    const value = nonBlank(candidate);
    if (value !== null) return value;
  }

  return fallback;
}

export function localizedArray(content: LocalizedArray, locale: Locale): readonly string[] {
  const candidates = locale === "ko"
    ? [content.ko, content.vi, content.en]
    : locale === "vi"
      ? [content.vi, content.en, content.ko]
      : [content.en, content.vi, content.ko];

  for (const candidate of candidates) {
    const value = nonEmpty(candidate);
    if (value !== null) return value;
  }

  return [];
}
