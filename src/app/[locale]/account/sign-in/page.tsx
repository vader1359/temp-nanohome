import { notFound } from "next/navigation";

import { AccountAuthFlow } from "@/components/account/account-auth-flow";
import { safeAccountReturnTo } from "@/lib/account/auth-flow";
import { isSupportedLocale } from "@/i18n/routing";

type AccountSignInPageProps = Readonly<{
  readonly params: Promise<Readonly<{ readonly locale: string }>>;
  readonly searchParams: Promise<Readonly<{ readonly returnTo?: string }>>;
}>;

export default async function AccountSignInPage({ params, searchParams }: AccountSignInPageProps) {
  const [{ locale }, { returnTo }] = await Promise.all([params, searchParams]);
  if (!isSupportedLocale(locale)) notFound();
  return <main className="min-h-[calc(100vh-var(--header-height,80px))] bg-nh-surface-warm px-4 py-12 md:px-6 md:py-16"><AccountAuthFlow locale={locale} returnTo={safeAccountReturnTo(locale, returnTo)} /></main>;
}
