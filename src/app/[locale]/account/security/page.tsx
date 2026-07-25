import { AccountSecurityForm } from "@/components/account/account-security-form";
import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) {
    return <section aria-labelledby="account-security-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-security-title">Bảo mật tài khoản</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Bảo mật tài khoản hiện chưa khả dụng.</p></section>;
  }
  const security = await getAccountSecurityPort().getSecurity(account);
  return <section aria-labelledby="account-security-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-security-title">Bảo mật tài khoản</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Quản lý phương thức đăng nhập, phiên sử dụng và yêu cầu xóa tài khoản.</p><AccountSecurityForm security={security} /></section>;
}
