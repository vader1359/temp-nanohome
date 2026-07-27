import type { ReactNode } from "react";

export type ProfileProviderMetadata = Readonly<{
  readonly provider: string;
  readonly identifier: string;
}>;

export type ProfileNoticeProfile = Readonly<{
  readonly fullName: string | null;
  readonly dateOfBirth: string | null;
  readonly nationality: string | null;
  readonly formOfAddress: string | null;
  readonly locale: string | null;
  readonly primaryEmail: string | null;
  readonly primaryPhone: string | null;
  readonly providerMetadata?: readonly ProfileProviderMetadata[];
}>;

type MissingField = Readonly<{ readonly key: keyof Pick<ProfileNoticeProfile, "fullName" | "dateOfBirth" | "nationality" | "formOfAddress" | "locale">; readonly label: string }>;

const recommendedFields: readonly MissingField[] = [
  { key: "fullName", label: "Họ và tên" },
  { key: "dateOfBirth", label: "Ngày sinh" },
  { key: "nationality", label: "Quốc tịch" },
  { key: "formOfAddress", label: "Xưng hô" },
  { key: "locale", label: "Ngôn ngữ" },
];

function Notice({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="border border-[var(--nh-border)] bg-[var(--nh-surface-warm)] p-4 text-sm leading-6 text-[var(--nh-ink)]" role="note" aria-label={title}>
      <strong className="font-medium">{title}</strong>
      <div className="mt-1 text-[var(--nh-muted)]">{children}</div>
    </div>
  );
}

export function ProfileNotice({ profile }: Readonly<{ profile: ProfileNoticeProfile }>) {
  const missingFields = recommendedFields.filter(({ key }) => profile[key] === null);
  const notices: ReactNode[] = [];

  const providerMetadata = profile.providerMetadata ?? [];

  if (providerMetadata.length > 0) {
    notices.push(
      <Notice key="provider" title="Thông tin nhà cung cấp chưa xác minh">
        <p>Những thông tin sau chưa được xác minh và không phải email chính:</p>
        <ul className="list-disc pl-5">
          {providerMetadata.map(({ provider, identifier }) => (
            <li key={`${provider}:${identifier}`}>
              {provider}: {identifier} <span>(Chưa xác minh)</span>
            </li>
          ))}
        </ul>
      </Notice>,
    );
  }

  if (missingFields.length > 0) {
    notices.push(
      <Notice key="recommended" title="Thông tin hồ sơ được đề xuất">
        <p>Bổ sung các trường tùy chọn để hoàn thiện hồ sơ:</p>
        <ul className="list-disc pl-5">{missingFields.map(({ key, label }) => <li key={key}>{label}</li>)}</ul>
      </Notice>,
    );
  }

  if (profile.primaryEmail === null) {
    notices.push(
      <Notice key="phone-only" title="Chỉ có số điện thoại đã xác minh.">
        <p>Thêm email trong Bảo mật để khôi phục tài khoản dễ dàng hơn.</p>
      </Notice>,
    );
  }

  return notices.length > 0 ? <div className="grid gap-4">{notices}</div> : null;
}
