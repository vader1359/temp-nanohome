"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface LocaleErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

// Locale-scoped error boundary. Relies on the NextIntlClientProvider set up in
// src/app/[locale]/layout.tsx, so `useTranslations('Common')` works in this
// 'use client' component. No error tracking integration per plan T236.
export default function Error({ error, unstable_retry }: LocaleErrorProps) {
  const t = useTranslations("Common");
  console.error("locale-error:", error);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{t("error_title")}</h1>
      <p className="text-muted-foreground">{t("error_description")}</p>
      <Button onClick={() => unstable_retry()} variant="default">
        {t("error_retry")}
      </Button>
    </main>
  );
}