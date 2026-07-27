import { AccountProfileForm } from "@/components/account/account-profile-form";
import { getAccountAuthPort, getAccountProfilePort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();

  if (account === null) {
    return (
      <section aria-labelledby="account-profile-title">
        <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-profile-title">{t("profile.title")}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("profile.unavailable")}</p>
      </section>
    );
  }

  const profile = await getAccountProfilePort().getProfile(account);
  return (
    <section aria-labelledby="account-profile-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-profile-title">{t("profile.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("profile.description")}</p>
      <AccountProfileForm profile={profile} />
    </section>
  );
}
