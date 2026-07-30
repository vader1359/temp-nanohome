"use client";

import { useTranslations } from "next-intl";

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  parseInternationalPhone,
  type SupportedPhoneCountry,
} from "@/lib/auth/phone-e164";
import { cn } from "@/lib/utils";

type InternationalPhoneFieldProps = Readonly<{
  readonly value: string;
  readonly country: SupportedPhoneCountry;
  readonly onChange: (value: string) => void;
  readonly onCountryChange: (country: SupportedPhoneCountry) => void;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly id: string;
  readonly required?: boolean;
}>;

function displayValue(value: string, country: SupportedPhoneCountry): string {
  const parsed = parseInternationalPhone(value, country);
  if (parsed === null) return value;
  return parsed.nationalNumber;
}

export function InternationalPhoneField({
  country,
  disabled = false,
  error,
  id,
  onChange,
  onCountryChange,
  required = false,
  value,
}: InternationalPhoneFieldProps) {
  const t = useTranslations("Account.authFlow");
  const errorId = `${id}-error`;
  const describedBy = error === undefined ? undefined : errorId;

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor={`${id}-country`}>
          {t("countryCodeLabel")}
          <select
            aria-label={t("countryCodeLabel")}
            className="min-h-12 border-b border-nh-border bg-transparent px-1 text-base outline-none focus:border-nh-ink disabled:opacity-50"
            disabled={disabled}
            id={`${id}-country`}
            onChange={(event) => {
              const nextCountry = PHONE_COUNTRIES.find((item) => item.countryCode === event.target.value);
              if (nextCountry !== undefined) onCountryChange(nextCountry);
            }}
            value={country.countryCode}
          >
            {PHONE_COUNTRIES.map((item) => (
              <option key={item.countryCode} value={item.countryCode}>
                {item.dialCode} · {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor={id}>
          {t("phoneNumber")}
          <input
            aria-describedby={describedBy}
            aria-label={t("phoneNumber")}
            autoComplete="tel-national"
            className={cn(
              "min-h-12 border-b border-nh-border bg-transparent px-1 text-base outline-none focus:border-nh-ink",
              error === undefined ? "" : "border-nh-red",
            )}
            disabled={disabled}
            id={id}
            inputMode="tel"
            onChange={(event) => {
              const nextValue = event.target.value;
              const parsed = parseInternationalPhone(nextValue, country);
              const compact = nextValue.trim().replace(/[\s().-]/gu, "");
              const isPastedInternational = /^(?:\+|00|84)/u.test(compact);
              onChange(parsed !== null && isPastedInternational ? parsed.nationalNumber : nextValue);
            }}
            placeholder={DEFAULT_PHONE_COUNTRY.countryCode === country.countryCode ? "090 123 4567" : undefined}
            required={required}
            type="tel"
            value={displayValue(value, country)}
          />
        </label>
      </div>
      {error === undefined ? null : <p className="text-sm text-nh-red" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
