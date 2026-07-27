import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { safeAccountReturnTo } from "@/lib/account/auth-flow";
import { isSupportedLocale } from "@/i18n/routing";

type EmailLinkPageProps = Readonly<{
  readonly params: Promise<Readonly<{ readonly locale: string }>>;
  readonly searchParams: Promise<Readonly<{ readonly returnTo?: string }>>;
}>;

export default async function EmailLinkPage({ params, searchParams }: EmailLinkPageProps) {
  const [{ locale }, { returnTo }] = await Promise.all([params, searchParams]);

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Account" });
  const destination = safeAccountReturnTo(locale, returnTo);

  return (
    <main className="min-h-[calc(100vh-var(--header-height,80px))] bg-nh-surface-warm px-4 py-12 md:px-6 md:py-16">
      <section aria-labelledby="email-link-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8">
        <h1 className="text-2xl font-medium text-nh-ink" id="email-link-title">{t("emailLink.title")}</h1>
        <p aria-live="polite" className="text-sm leading-6 text-nh-muted" role="status">{t("emailLink.body")}</p>
        <a className="inline-flex min-h-11 items-center justify-center bg-nh-ink px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" href={destination}>{t("common.continue")}</a>
      </section>
    </main>
  );
}
