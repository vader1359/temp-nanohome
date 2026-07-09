"use client";

import { useTranslations, useLocale } from "next-intl";
import { DarkCTAButton } from "@/components/shared/dark-cta-button";

interface AuthFormProps {
  onSwitchView: (view: "login" | "register" | "forgot") => void;
  redirectTo?: string;
  authError?: string;
}

export function ForgotPasswordForm({ onSwitchView, redirectTo, authError }: AuthFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <h2 className="text-2xl font-normal leading-8 text-nh-ink mb-2">
          {t("forgot.title")}
        </h2>
        <p className="text-sm text-nh-muted leading-5 mb-8">
          {t("forgot.subtitle")}
        </p>

        {authError === "forgot_error" && (
          <p className="text-sm text-nh-red mb-6">
            {t("errors.forgotError")}
          </p>
        )}

        <form action="/auth/forgot-password" method="POST" className="flex flex-col gap-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? `/${locale}`} />

          <div className="flex flex-col gap-2">
            <label htmlFor="forgot-email" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.email")}
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              required
              placeholder={t("fields.email")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <DarkCTAButton type="submit" className="w-full mt-4">
            {t("forgot.submit")}
          </DarkCTAButton>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => onSwitchView("login")}
            className="text-xs uppercase tracking-wider text-nh-ink hover:text-nh-accent transition-colors underline underline-offset-4"
          >
            {t("common.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
}
