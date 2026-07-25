import { notFound } from "next/navigation";

import { safeAccountReturnTo } from "@/lib/account/auth-flow";
import { isSupportedLocale } from "@/i18n/routing";

type AccountCompletePageProps = Readonly<{
  readonly params: Promise<Readonly<{ readonly locale: string }>>;
  readonly searchParams: Promise<Readonly<{ readonly returnTo?: string }>>;
}>;

export default async function AccountCompletePage({ params, searchParams }: AccountCompletePageProps) {
  const [{ locale }, { returnTo }] = await Promise.all([params, searchParams]);
  if (!isSupportedLocale(locale)) notFound();
  const destination = safeAccountReturnTo(locale, returnTo);
  return <main className="min-h-[calc(100vh-var(--header-height,80px))] bg-nh-surface-warm px-4 py-12 md:px-6 md:py-16"><section aria-labelledby="account-complete-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8"><h1 className="text-2xl font-medium text-nh-ink" id="account-complete-title">Sign-in complete</h1><p role="status" aria-live="polite" className="text-sm leading-6 text-nh-muted">You can safely continue to your destination.</p><a href={destination} className="inline-flex min-h-11 items-center justify-center bg-nh-ink px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent">Continue</a></section></main>;
}
