export const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/u;

export const PHONE_COUNTRIES = [
  {
    countryCode: "VN",
    dialCode: "+84",
    label: "Việt Nam",
  },
] as const;

export type SupportedPhoneCountry = (typeof PHONE_COUNTRIES)[number];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

const VIETNAM_MOBILE_PATTERN = /^0(?:3|5|7|8|9)\d{8}$/u;

type ParsedPhone = Readonly<{
  readonly country: SupportedPhoneCountry;
  readonly nationalNumber: string;
  readonly e164: string;
}>;

function compactPhone(value: string): string {
  return value.normalize("NFKC").trim().replace(/[\s().-]/gu, "");
}

function countryForInput(value: string, selectedCountry: SupportedPhoneCountry): Readonly<{
  readonly country: SupportedPhoneCountry;
  readonly nationalNumber: string;
}> {
  for (const country of PHONE_COUNTRIES) {
    if (value.startsWith(country.dialCode)) {
      return { country, nationalNumber: value.slice(country.dialCode.length) };
    }
    const withoutPlus = country.dialCode.slice(1);
    if (value.startsWith(`00${withoutPlus}`)) {
      return { country, nationalNumber: value.slice(`00${withoutPlus}`.length) };
    }
    if (value.startsWith(withoutPlus) && value.length > withoutPlus.length + 1) {
      return { country, nationalNumber: value.slice(withoutPlus.length) };
    }
  }

  return { country: selectedCountry, nationalNumber: value };
}

export function parseInternationalPhone(
  value: string,
  selectedCountry: SupportedPhoneCountry = DEFAULT_PHONE_COUNTRY,
): ParsedPhone | null {
  const compact = compactPhone(value);
  if (compact === "" || !/^(?:\+|00)?\d+$/u.test(compact)) return null;

  const { country, nationalNumber: rawNationalNumber } = countryForInput(compact, selectedCountry);
  const nationalNumber = rawNationalNumber.startsWith("0")
    ? rawNationalNumber
    : `0${rawNationalNumber}`;

  if (country.countryCode === "VN" && !VIETNAM_MOBILE_PATTERN.test(nationalNumber)) {
    return null;
  }

  const e164 = `${country.dialCode}${nationalNumber.slice(1)}`;
  return E164_PHONE_PATTERN.test(e164) ? { country, e164, nationalNumber } : null;
}

export function normalizeInternationalPhone(
  value: string,
  selectedCountry: SupportedPhoneCountry = DEFAULT_PHONE_COUNTRY,
): string | null {
  return parseInternationalPhone(value, selectedCountry)?.e164 ?? null;
}

export function isE164Phone(value: unknown): value is string {
  return typeof value === "string" && E164_PHONE_PATTERN.test(value);
}

export function formatInternationalPhone(value: string): string {
  if (!isE164Phone(value)) return value;
  if (value.startsWith("+84") && value.length === 12) {
    const national = value.slice(3);
    return `+84 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return value;
}
