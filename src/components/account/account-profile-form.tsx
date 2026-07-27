"use client";

import { useState } from "react";

import { ProfileNotice, type ProfileNoticeProfile } from "./profile-notice";

export type ClientProfile = ProfileNoticeProfile;

type EditableField = "fullName" | "dateOfBirth" | "nationality" | "formOfAddress" | "locale";
type FormValues = Record<EditableField, string>;
type FieldErrors = Readonly<Record<string, string>>;

function isFieldErrors(value: unknown): value is FieldErrors {
  return value !== null && typeof value === "object" && Object.values(value).every((item) => typeof item === "string");
}

const fields: readonly { name: EditableField; label: string; type?: string }[] = [
  { name: "fullName", label: "Họ và tên" },
  { name: "dateOfBirth", label: "Ngày sinh", type: "text" },
  { name: "nationality", label: "Quốc tịch" },
  { name: "formOfAddress", label: "Xưng hô" },
  { name: "locale", label: "Ngôn ngữ" },
];

function initialValues(profile: ClientProfile): FormValues {
  return {
    fullName: profile.fullName ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    nationality: profile.nationality ?? "",
    formOfAddress: profile.formOfAddress ?? "",
    locale: profile.locale ?? "",
  };
}

export function AccountProfileForm({ profile }: Readonly<{ profile: ClientProfile }>) {
  const [values, setValues] = useState<FormValues>(() => initialValues(profile));
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const original = initialValues(profile);
    const patch = Object.fromEntries(fields
      .filter(({ name }) => values[name] !== original[name])
      .map(({ name }) => [name, values[name]]));
    if (Object.keys(patch).length === 0) {
      setStatus("Không có thay đổi để lưu.");
      setPending(false);
      return;
    }
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.status === 422) {
      const body: unknown = await response.json();
      if (body !== null && typeof body === "object" && "fieldErrors" in body && isFieldErrors(body.fieldErrors)) {
        setErrors(body.fieldErrors);
      }
      setPending(false);
      return;
    }
    if (!response.ok) {
      setStatus("Không thể lưu thay đổi. Vui lòng thử lại.");
      setPending(false);
      return;
    }
    setStatus("Đã lưu thay đổi.");
    setPending(false);
  }

  return (
    <>
      <ProfileNotice profile={profile} />
      <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium text-[var(--nh-ink)]">Liên hệ đã xác minh</legend>
          <label className="grid gap-2 text-sm text-[var(--nh-muted)]" htmlFor="profile-email">Email đã xác minh
            <input className="min-h-11 border-b border-[var(--nh-border)] bg-transparent px-1 text-[var(--nh-muted)]" id="profile-email" value={profile.primaryEmail ?? "Chưa có email"} readOnly aria-readonly="true" />
          </label>
          <label className="grid gap-2 text-sm text-[var(--nh-muted)]" htmlFor="profile-phone">Số điện thoại đã xác minh
            <input className="min-h-11 border-b border-[var(--nh-border)] bg-transparent px-1 text-[var(--nh-muted)]" id="profile-phone" value={profile.primaryPhone ?? "Chưa có số điện thoại"} readOnly aria-readonly="true" />
          </label>
        </fieldset>
        <fieldset className="grid gap-4">
          <legend className="text-sm font-medium text-[var(--nh-ink)]">Thông tin có thể chỉnh sửa</legend>
          {fields.map(({ name, label, type }) => {
            const error = errors[name];
            return <label className="grid gap-2 text-sm text-[var(--nh-muted)]" htmlFor={`profile-${name}`} key={name}>{label}
              <input className="min-h-11 border-b border-[var(--nh-border)] bg-transparent px-1 text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--nh-accent)]" id={`profile-${name}`} type={type ?? "text"} value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} aria-invalid={error !== undefined} aria-describedby={error ? `profile-${name}-error` : undefined} />
              {error ? <span id={`profile-${name}-error`} role="alert" className="text-[var(--nh-red)]">{error}</span> : null}
            </label>;
          })}
        </fieldset>
        <button className="min-h-11 w-fit bg-[var(--nh-ink)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)] disabled:opacity-50" disabled={pending} type="submit">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button>
        <p aria-live="polite" className="text-sm text-[var(--nh-muted)]">{status}</p>
      </form>
    </>
  );
}
