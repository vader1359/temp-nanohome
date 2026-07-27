import { z } from "zod";

import { locales, type Locale } from "@/i18n/routing";

export const accountAuthFlowMethods = ["magic_link", "password", "google", "kakao", "phone_otp"] as const;
export type AccountAuthFlowMethod = (typeof accountAuthFlowMethods)[number];

export const accountAuthFlowActions = ["start", "verify"] as const;
export type AccountAuthFlowAction = (typeof accountAuthFlowActions)[number];

export type AccountAuthFlowRequest = Readonly<{
  readonly action: AccountAuthFlowAction;
  readonly email: string;
  readonly locale: Locale;
  readonly method: AccountAuthFlowMethod;
  readonly otp: string;
  readonly password: string;
  readonly phone: string;
  readonly returnTo: string;
}>;

export type AccountAuthFlowOutcome =
  | Readonly<{ readonly kind: "completed"; readonly returnTo: string }>
  | Readonly<{ readonly kind: "retryable_error" }>
  | Readonly<{ readonly kind: "verification_required"; readonly method: "magic_link" | "phone_otp"; readonly returnTo: string }>;

const requestSchema = z.object({
  action: z.enum(accountAuthFlowActions),
  email: z.string().trim().max(320).optional(),
  locale: z.enum(locales),
  method: z.enum(accountAuthFlowMethods),
  otp: z.string().trim().max(16).optional(),
  password: z.string().max(512).optional(),
  phone: z.string().trim().max(32).optional(),
  returnTo: z.string().max(2048).optional(),
}).strict();

const outcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed"), returnTo: z.string().min(1).max(2048) }).strict(),
  z.object({ kind: z.literal("retryable_error") }).strict(),
  z.object({ kind: z.literal("verification_required"), method: z.enum(["magic_link", "phone_otp"]), returnTo: z.string().min(1).max(2048) }).strict(),
]);

export function safeAccountReturnTo(locale: Locale, candidate: string | undefined): string {
  if (candidate === undefined || !candidate.startsWith(`/${locale}`)) return `/${locale}`;
  const boundary = candidate.charAt(locale.length + 1);
  if (boundary !== "" && boundary !== "/" && boundary !== "?") return `/${locale}`;

  const url = new URL(candidate, "https://account.local");
  if (url.origin !== "https://account.local") return `/${locale}`;
  url.searchParams.delete("auth");
  const search = url.searchParams.toString();
  return `${url.pathname}${search === "" ? "" : `?${search}`}`;
}

export function parseAccountAuthFlowRequest(input: unknown): AccountAuthFlowRequest {
  const parsed = requestSchema.parse(input);
  return {
    action: parsed.action,
    email: parsed.email ?? "",
    locale: parsed.locale,
    method: parsed.method,
    otp: parsed.otp ?? "",
    password: parsed.password ?? "",
    phone: parsed.phone ?? "",
    returnTo: safeAccountReturnTo(parsed.locale, parsed.returnTo),
  };
}

export function parseAccountAuthFlowOutcome(input: unknown): AccountAuthFlowOutcome {
  return outcomeSchema.parse(input);
}
