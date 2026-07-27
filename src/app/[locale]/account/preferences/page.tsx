import { AccountPreferencesForm } from "@/components/account/account-preferences-form";
import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage() {
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();

  if (account === null) {
    return (
      <section aria-labelledby="account-preferences-title">
        <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-preferences-title">{t("preferences.title")}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("preferences.unavailable")}</p>
      </section>
    );
  }

  const preferences = await getAccountPreferencesPort().getPreferences(account);
  return (
    <section aria-labelledby="account-preferences-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-preferences-title">{t("preferences.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("preferences.description")}</p>
      <AccountPreferencesForm preferences={preferences} />
    </section>
  );
}
