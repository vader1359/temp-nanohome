"use client";

import { useLocale, useTranslations } from "next-intl";

import { DarkCTAButton } from "@/components/shared/dark-cta-button";

export type ResetPasswordStatus = "error" | "invalid" | "success" | "validation" | undefined;

interface ResetPasswordFormProps {
  readonly status?: ResetPasswordStatus;
}

export function ResetPasswordForm({ status }: ResetPasswordFormProps) {
  const locale = useLocale();
  const t = useTranslations("Auth");

  if (status === "success") {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-20 sm:py-28">
        <section aria-labelledby="reset-password-title">
          <h1 id="reset-password-title" className="text-2xl font-normal leading-8 text-nh-ink">
            {t("reset.successTitle")}
          </h1>
          <p className="mt-3 text-sm leading-5 text-nh-muted">{t("reset.successBody")}</p>
          <a
            href={`/${locale}?auth=login`}
            className="mt-8 inline-flex min-h-11 items-center text-xs uppercase tracking-wider text-nh-ink underline underline-offset-4 transition-colors hover:text-nh-accent"
          >
            {t("common.backToLogin")}
          </a>
        </section>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-20 sm:py-28">
        <section aria-labelledby="reset-password-title">
          <h1 id="reset-password-title" className="text-2xl font-normal leading-8 text-nh-ink">
            {t("reset.expiredTitle")}
          </h1>
          <p className="mt-3 text-sm leading-5 text-nh-muted">{t("reset.expiredBody")}</p>
          <a
            href={`/${locale}?auth=forgot`}
            className="mt-8 inline-flex min-h-11 items-center text-xs uppercase tracking-wider text-nh-ink underline underline-offset-4 transition-colors hover:text-nh-accent"
          >
            {t("reset.resend")}
          </a>
        </section>
      </main>
    );
  }

  const message = status === "validation" || status === "error" ? t("errors.resetError") : null;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-20 sm:py-28">
      <section aria-labelledby="reset-password-title">
        <h1 id="reset-password-title" className="text-2xl font-normal leading-8 text-nh-ink">
          {t("reset.title")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-nh-muted">{t("reset.subtitle")}</p>
        {message ? <p id="reset-password-error" role="alert" className="mt-6 text-sm text-nh-red">{message}</p> : null}

        <form action="/auth/reset-password" method="POST" className="mt-8 flex flex-col gap-6" aria-label={t("reset.title")}>
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-password" className="sr-only">{t("fields.newPassword")}</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              required
              minLength={8}
              aria-describedby={message ? "reset-password-error" : undefined}
              aria-invalid={message ? true : undefined}
              placeholder={t("fields.newPassword")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted transition-colors focus:border-nh-ink focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-confirm-password" className="sr-only">{t("fields.confirmPassword")}</label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              aria-describedby={message ? "reset-password-error" : undefined}
              aria-invalid={message ? true : undefined}
              placeholder={t("fields.confirmPassword")}
              className="w-full border-b border-nh-border bg-transparent pb-2 text-base text-nh-ink placeholder:text-nh-muted transition-colors focus:border-nh-ink focus:outline-none"
            />
          </div>
          <DarkCTAButton type="submit" className="mt-4 w-full">{t("reset.submit")}</DarkCTAButton>
        </form>
      </section>
    </main>
  );
}
