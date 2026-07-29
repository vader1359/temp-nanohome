import { z } from "zod";

import type { Locale } from "@/i18n/routing";

import { getSafeRedirectPath, getSupportedLocale } from "./redirect";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  redirectTo: z.string().nullable(),
  locale: z.string().nullable(),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(1),
  agreeTerms: z.literal("on"),
  redirectTo: z.string().nullable(),
  locale: z.string().nullable(),
}).refine((value) => value.password === value.confirmPassword);

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  locale: z.string().nullable(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
  locale: z.string().nullable(),
  oobCode: z.string().min(1).max(2048),
}).refine((value) => value.password === value.confirmPassword);

type AuthCredentials = {
  readonly email: string;
  readonly password: string;
  readonly redirectTo: string;
  readonly locale: Locale;
};

type SignUpCredentials = AuthCredentials;

type ForgotPasswordCredentials = {
  readonly email: string;
  readonly locale: Locale;
  readonly redirectTo: string;
};

type ResetPasswordCredentials = {
  readonly password: string;
  readonly locale: Locale;
  readonly oobCode: string;
  readonly redirectTo: string;
};

type ParseEmailPasswordFormResult =
  | { readonly ok: true; readonly value: AuthCredentials }
  | { readonly ok: false };

type ParseSignUpFormResult =
  | { readonly ok: true; readonly value: SignUpCredentials }
  | { readonly ok: false; readonly error: "password_mismatch" | "terms_required" | "invalid" };

type ParseForgotPasswordFormResult =
  | { readonly ok: true; readonly value: ForgotPasswordCredentials }
  | { readonly ok: false };

type ParseResetPasswordFormResult =
  | { readonly ok: true; readonly value: ResetPasswordCredentials }
  | { readonly ok: false };

export function parseEmailPasswordForm(formData: FormData): ParseEmailPasswordFormResult {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const locale = getSupportedLocale(parsed.data.locale);

  return {
    ok: true,
    value: {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: getSafeRedirectPath(parsed.data.redirectTo, locale),
      locale,
    },
  };
}

export function parseSignUpForm(formData: FormData): ParseSignUpFormResult {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof password === "string" && typeof confirmPassword === "string" && password !== confirmPassword) {
    return { ok: false, error: "password_mismatch" };
  }

  if (formData.get("agreeTerms") !== "on") {
    return { ok: false, error: "terms_required" };
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
    locale: formData.get("locale"),
    confirmPassword: formData.get("confirmPassword"),
    agreeTerms: formData.get("agreeTerms"),
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const locale = getSupportedLocale(parsed.data.locale);

  return {
    ok: true,
    value: {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: getSafeRedirectPath(parsed.data.redirectTo, locale),
      locale,
    },
  };
}

export function parseForgotPasswordForm(formData: FormData): ParseForgotPasswordFormResult {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const locale = getSupportedLocale(parsed.data.locale);

  return {
    ok: true,
    value: {
      email: parsed.data.email,
      locale,
      redirectTo: `/${locale}/reset-password`,
    },
  };
}

export function parseResetPasswordForm(formData: FormData): ParseResetPasswordFormResult {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    locale: formData.get("locale"),
    oobCode: formData.get("oobCode"),
  });

  if (!parsed.success) {
    return { ok: false };
  }

  const locale = getSupportedLocale(parsed.data.locale);

  return {
    ok: true,
    value: {
      password: parsed.data.password,
      locale,
      oobCode: parsed.data.oobCode,
      redirectTo: `/${locale}/reset-password?status=success`,
    },
  };
}
