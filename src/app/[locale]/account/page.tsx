import { AccountProfileForm } from "@/components/account/account-profile-form";
import { getAccountProfilePort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type AccountProfilePageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export default async function AccountProfilePage({ params }: AccountProfilePageProps) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account`);

  const profile = await getAccountProfilePort().getProfile(account);
  return (
    <section aria-labelledby="account-profile-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-profile-title">{t("profile.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("profile.description")}</p>
      <AccountProfileForm profile={profile} />
      <form action="/auth/sign-out" className="mt-8 border-t border-[var(--nh-border)] pt-6" method="POST">
        <input name="locale" type="hidden" value={locale} />
        <input name="redirectTo" type="hidden" value={`/${locale}`} />
        <button className="min-h-11 border border-[var(--nh-border)] px-5 text-sm text-[var(--nh-ink)]" type="submit">
          {t("navigation.signOut")}
        </button>
      </form>
    </section>
  );
}
