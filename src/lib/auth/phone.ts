const VIETNAM_MOBILE_PATTERN = /^0(?:3|5|7|8|9)\d{8}$/u;

export function normalizeVietnamPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/gu, "");
  const national = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("0084")
      ? `0${compact.slice(4)}`
      : compact.startsWith("84")
        ? `0${compact.slice(2)}`
        : compact;

  if (!VIETNAM_MOBILE_PATTERN.test(national)) return null;
  return `+84${national.slice(1)}`;
}
