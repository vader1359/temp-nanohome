import { AccountSecurityForm } from "@/components/account/account-security-form";
import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) {
    return <section aria-labelledby="account-security-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-security-title">{t("security.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("security.unavailable")}</p></section>;
  }
  const security = await getAccountSecurityPort().getSecurity(account);
  return <section aria-labelledby="account-security-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-security-title">{t("security.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("security.description")}</p><AccountSecurityForm security={security} /></section>;
}
