"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

// Rendered when notFound() is thrown inside a valid /[locale] segment.
// [locale]/layout.tsx has already mounted NextIntlClientProvider, so a client
// component can use useTranslations('Common'). Invalid locale prefixes (e.g.
// /de) throw notFound() in layout.tsx before the provider mounts → root
// app/not-found.tsx handles them. Next 16 not-found accepts no props.
export default function NotFound() {
  const t = useTranslations("Common");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">{t("not_found_description")}</p>
      <Link
        href="/"
        className="text-primary underline underline-offset-4 hover:opacity-80"
      >
        {t("not_found_home")}
      </Link>
    </main>
  );
}