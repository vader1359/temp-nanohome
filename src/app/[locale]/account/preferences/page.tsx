import { AccountPreferencesForm } from "@/components/account/account-preferences-form";
import { getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type AccountPreferencesPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export default async function AccountPreferencesPage({ params }: AccountPreferencesPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account/preferences`);

  const preferences = await getAccountPreferencesPort().getPreferences(account);
  return (
    <section aria-labelledby="account-preferences-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-preferences-title">{t("preferences.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("preferences.description")}</p>
      <AccountPreferencesForm preferences={preferences} />
    </section>
  );
}
