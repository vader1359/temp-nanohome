import { AccountSecurityForm } from "@/components/account/account-security-form";
import { getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type AccountSecurityPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export default async function AccountSecurityPage({ params }: AccountSecurityPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account/security`);
  const security = await getAccountSecurityPort().getSecurity(account);
  return <section aria-labelledby="account-security-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-security-title">{t("security.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("security.description")}</p><AccountSecurityForm security={security} /></section>;
}
