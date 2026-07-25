import { AccountProfileForm } from "@/components/account/account-profile-form";
import { getAccountAuthPort, getAccountProfilePort } from "@/lib/account/account-ports.server";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();

  if (account === null) {
    return (
      <section aria-labelledby="account-profile-title">
        <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-profile-title">Hồ sơ của tôi</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Thông tin hồ sơ hiện chưa khả dụng.</p>
      </section>
    );
  }

  const profile = await getAccountProfilePort().getProfile(account);
  return (
    <section aria-labelledby="account-profile-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-profile-title">Hồ sơ của tôi</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Cập nhật thông tin để nanoHome phục vụ bạn tốt hơn.</p>
      <AccountProfileForm profile={profile} />
    </section>
  );
}
