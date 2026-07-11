"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

interface CheckEmailViewProps {
  readonly signupCompleted: boolean;
}

export function CheckEmailView({ signupCompleted }: CheckEmailViewProps) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const hasAnnounced = useRef(false);
  const title = t("checkEmail.title");
  const description = t("checkEmail.body");

  useEffect(() => {
    if (!signupCompleted || hasAnnounced.current) return;

    const timeoutId = window.setTimeout(() => {
      toast.success(title, { description });
      hasAnnounced.current = true;
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [description, signupCompleted, title]);

  return (
    <main
      className={
        signupCompleted
          ? "mx-auto w-full max-w-md px-6 pb-20 pt-80 sm:pb-28 sm:pt-96"
          : "mx-auto w-full max-w-md px-6 py-20 sm:py-28"
      }
    >
      <section aria-labelledby="check-email-title">
        <h1 id="check-email-title" className="text-2xl font-normal leading-8 text-nh-ink">
          {t("checkEmail.title")}
        </h1>
        <p className="mt-3 text-sm leading-5 text-nh-muted">{t("checkEmail.body")}</p>
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
