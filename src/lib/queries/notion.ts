import { NotionAPI } from "notion-client";
import type { Json } from "@/types/database.types";

const notion = new NotionAPI();
const NOTION_ID_PATTERN = /[0-9a-fA-F]{32}/u;

function rawRecord(value: Json): Readonly<Record<string, Json | undefined>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

function rawString(record: Readonly<Record<string, Json | undefined>>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function localizedRawString(raw: Json, englishKey: string, vietnameseKey: string, locale: string): string | null {
  const record = rawRecord(raw);
  if (record === null) {
    return null;
  }

  const englishValue = rawString(record, englishKey);
  const vietnameseValue = rawString(record, vietnameseKey);
  const koreanValue = rawString(record, `${englishKey}__ko`) ?? rawString(record, `${englishKey}_ko`);

  if (locale === "ko") {
    return koreanValue ?? vietnameseValue ?? englishValue;
  }

  return locale === "vi" ? vietnameseValue ?? englishValue ?? koreanValue : englishValue ?? vietnameseValue ?? koreanValue;
}

export function localizedNewsDescription(raw: Json, fallback: string | null, locale: string): string | null {
  return localizedRawString(raw, "meta_description", "meta_description__vi", locale)
    ?? localizedRawString(raw, "meta_description", "meta_description_vi", locale)
    ?? localizedRawString(raw, "description", "description__vi", locale)
    ?? localizedRawString(raw, "description", "description_vi", locale)
    ?? localizedRawString(raw, "excerpt", "excerpt__vi", locale)
    ?? fallback;
}

export function localizedNotionLink(raw: Json, locale: string): string | null {
  return localizedRawString(raw, "link", "link__vi", locale);
}

export function extractNotionPageId(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const compactValue = value.replace(/-/g, "");
  const match = NOTION_ID_PATTERN.exec(compactValue);
  return match?.[0] ?? null;
}

export async function getNotionRecordMap(pageId: string) {
  return notion.getPage(pageId);
}
