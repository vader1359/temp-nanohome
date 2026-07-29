"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { DarkCTAButton } from "@/components/shared/dark-cta-button";

interface AuthFormProps {
  onSwitchView: (view: "login" | "register" | "forgot") => void;
  redirectTo?: string;
  authError?: string;
}

export function RegisterForm({ onSwitchView, redirectTo, authError }: AuthFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <h2 className="text-2xl font-normal leading-8 text-nh-ink mb-2">
          {t("register.title")}
        </h2>
        <p className="text-sm text-nh-muted leading-5 mb-8">
          {t("register.subtitle")}
        </p>

        {(authError === "sign_up_error" || authError === "password_mismatch" || authError === "terms_required") && (
          <p className="text-sm text-nh-red mb-6">
            {authError === "password_mismatch"
              ? t("errors.passwordMismatch")
              : authError === "terms_required"
                ? t("errors.termsRequired")
                : t("errors.signUpError")}
          </p>
        )}

        <form
          action="/auth/sign-up"
          method="POST"
          className="flex flex-col gap-6"
          aria-busy={isSubmitting}
          onSubmit={() => setIsSubmitting(true)}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? `/${locale}`} />

          <div className="flex flex-col gap-2">
            <label htmlFor="register-email" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.email")}
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              required
              placeholder={t("fields.email")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-password" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.password")}
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder={t("fields.password")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-confirm-password" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.confirmPassword")}
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder={t("fields.confirmPassword")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <label className="flex items-start gap-3 mt-2 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-1">
              <input
                type="checkbox"
                name="agreeTerms"
                required
                className="peer appearance-none w-4 h-4 border border-nh-border checked:bg-nh-ink checked:border-nh-ink transition-colors cursor-pointer"
              />
              <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-sm text-nh-muted group-hover:text-nh-ink transition-colors">
              {t("fields.agreeTerms")}
            </span>
          </label>

          {isSubmitting ? (
            <p role="status" className="sr-only">
              {t("register.submitting")}
            </p>
          ) : null}

          <DarkCTAButton type="submit" disabled={isSubmitting} className="w-full mt-4">
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                  data-testid="register-submit-indicator"
                />
                {t("register.submitting")}
              </span>
            ) : (
              t("register.submit")
            )}
          </DarkCTAButton>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => onSwitchView("login")}
            className="text-xs uppercase tracking-wider text-nh-ink hover:text-nh-accent transition-colors underline underline-offset-4"
          >
            {t("register.signInLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
