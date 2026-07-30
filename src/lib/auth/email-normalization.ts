const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(value: string): string | null {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return normalized !== "" && EMAIL_PATTERN.test(normalized) ? normalized : null;
}
