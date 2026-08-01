import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EmailLinkRecovery } from "./email-link-recovery";
import { isSupportedLocale } from "@/i18n/routing";

type EmailLinkPageProps = Readonly<{
  readonly params: Promise<Readonly<{ readonly locale: string }>>;
  readonly searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}>;

const RECOVERY_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function opaqueRecoveryState(value: string | undefined): string | undefined {
  return value !== undefined && RECOVERY_STATE_PATTERN.test(value) ? value : undefined;
}

function stateFromContinueUrl(locale: string, value: string | undefined): string | undefined {
  if (value === undefined || value.length > 4_096) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== `/${locale}/auth/email-link`) return undefined;
    return opaqueRecoveryState(url.searchParams.get("state") ?? undefined);
  } catch {
    return undefined;
  }
}

export default async function EmailLinkPage({ params, searchParams }: EmailLinkPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Account" });
  const cleanPath = `/${locale}/auth/email-link`;
  const directState = opaqueRecoveryState(first(query.state));
  const recoveryState = directState ?? stateFromContinueUrl(locale, first(query.continueUrl));

  return (
    <main className="min-h-[calc(100vh-var(--header-height,80px))] bg-nh-surface-warm px-4 py-12 md:px-6 md:py-16">
      <section aria-labelledby="email-link-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8">
        <h1 className="text-2xl font-medium text-nh-ink" id="email-link-title">{t("emailLink.title")}</h1>
        <EmailLinkRecovery
          actionCode={first(query.oobCode)}
          cleanPath={cleanPath}
          fallbackPath={`/${locale}/account/sign-in`}
          locale={locale}
          mode={first(query.mode)}
          recoveryState={recoveryState}
        />
      </section>
    </main>
  );
}
