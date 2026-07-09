"use client";

import { useTranslations, useLocale } from "next-intl";
import { DarkCTAButton } from "@/components/shared/dark-cta-button";

interface AuthFormProps {
  onSwitchView: (view: "login" | "register" | "forgot") => void;
  redirectTo?: string;
  authError?: string;
}

export function LoginForm({ onSwitchView, redirectTo, authError }: AuthFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <h2 className="text-2xl font-normal leading-8 text-nh-ink mb-2">
          {t("login.title")}
        </h2>
        <p className="text-sm text-nh-muted leading-5 mb-8">
          {t("login.subtitle")}
        </p>

        {(authError === "sign_in_error" || authError === "invalid_credentials") && (
          <p className="text-sm text-nh-red mb-6">
            {authError === "invalid_credentials" ? t("errors.invalidCredentials") : t("errors.signInError")}
          </p>
        )}

        <form action="/auth/sign-in" method="POST" className="flex flex-col gap-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="redirectTo" value={redirectTo ?? `/${locale}`} />

          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.email")}
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              placeholder={t("fields.email")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="login-password" className="text-xs uppercase tracking-wider text-nh-ink sr-only">
              {t("fields.password")}
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              placeholder={t("fields.password")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted focus:border-nh-ink focus:outline-none transition-colors"
            />
          </div>

          <div className="flex justify-end mt-[-8px]">
            <button
              type="button"
              onClick={() => onSwitchView("forgot")}
              className="text-xs uppercase tracking-wider text-nh-accent hover:text-nh-ink transition-colors"
            >
              {t("login.forgotPassword")}
            </button>
          </div>

          <DarkCTAButton type="submit" className="w-full mt-2">
            {t("login.submit")}
          </DarkCTAButton>
        </form>

        <div className="mt-8 pt-8 border-t border-nh-border">
          <button
            type="button"
            onClick={() => onSwitchView("register")}
            className="w-full border border-nh-ink bg-transparent text-nh-ink uppercase tracking-wider hover:bg-nh-ink/5 px-8 py-4 text-sm font-medium transition-colors"
          >
            {t("login.createAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
