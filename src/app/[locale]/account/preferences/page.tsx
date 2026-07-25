import { AccountPreferencesForm } from "@/components/account/account-preferences-form";
import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();

  if (account === null) {
    return (
      <section aria-labelledby="account-preferences-title">
        <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-preferences-title">Tùy chọn tài khoản</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Tùy chọn tài khoản hiện chưa khả dụng.</p>
      </section>
    );
  }

  const preferences = await getAccountPreferencesPort().getPreferences(account);
  return (
    <section aria-labelledby="account-preferences-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-preferences-title">Tùy chọn tài khoản</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Quản lý cách dữ liệu tài khoản được sử dụng cho trải nghiệm của bạn.</p>
      <AccountPreferencesForm preferences={preferences} />
    </section>
  );
}
