const MAX_QUERY_LENGTH = 200;
const POSTGREST_RESERVED_VALUE_CHARACTERS = /[",.:*()\\]/u;

export type SearchLocale = "en" | "vi" | "ko";

export function normalizeSearchQuery(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").slice(0, MAX_QUERY_LENGTH);
}

export function postgrestFilterValue(searchTerm: string): string {
  if (!POSTGREST_RESERVED_VALUE_CHARACTERS.test(searchTerm)) {
    return searchTerm;
  }

  return `"${searchTerm.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
