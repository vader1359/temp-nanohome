"use client";

import { useState } from "react";

import { parseSecurityActionResponse, type AccountSecurity, type SecurityAuthAction } from "@/lib/account/security-schema";

type AccountSecurityFormProps = Readonly<{ readonly security: AccountSecurity }>;

const buttonClassName = "min-h-11 border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]";

function unlinkAction(provider: AccountSecurity["identities"][number]["provider"]): SecurityAuthAction {
  switch (provider) {
    case "email": return "unlink_email";
    case "google": return "unlink_google";
    case "kakao": return "unlink_kakao";
    case "phone": return "unlink_phone";
  }
}

export function AccountSecurityForm({ security }: AccountSecurityFormProps) {
  const [currentSecurity, setCurrentSecurity] = useState(security);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");

  const request = async (path: string, body?: Readonly<Record<string, string>>): Promise<void> => {
    try {
      const response = await fetch(path, body === undefined ? { method: "POST" } : { body: JSON.stringify(body), headers: { "content-type": "application/json" }, method: "POST" });
      const result: unknown = await response.json();
      if (response.status === 409) { setNotice("Cần xác thực lại trước khi thực hiện thao tác này."); return; }
      if (response.status >= 400) { setNotice("Không thể hoàn tất thao tác bảo mật lúc này."); return; }
      const action = parseSecurityActionResponse(result);
      if (action === null) { setNotice("Không thể hoàn tất thao tác bảo mật lúc này."); return; }
      if (action.kind === "last_usable_method") { setNotice("Bạn cần giữ lại ít nhất một phương thức đăng nhập đã xác minh."); return; }
      if (action.kind === "deleted") { setNotice("Yêu cầu xóa tài khoản đã được xác nhận."); return; }
      if (action.kind === "completed") setCurrentSecurity(action.security);
      setNotice("");
    } catch { setNotice("Không thể hoàn tất thao tác bảo mật lúc này."); }
  };

  const unlink = (action: SecurityAuthAction): void => { if (window.confirm("Gỡ phương thức đăng nhập này?")) void request("/api/account/security/auth-actions", { action }); };
  const beginDeletion = (): void => { if (window.confirm("Bạn muốn bắt đầu xóa tài khoản?")) void request("/api/account/security/deletion", { action: "begin" }); };
  const confirmDeletion = (): void => { if (window.confirm("Xác nhận xóa tài khoản?")) void request("/api/account/security/deletion", { confirmation }); };

  return (
    <div className="mt-6 space-y-6 border-t border-[var(--nh-border)] pt-6">
      {notice ? <p aria-live="polite" className="text-sm text-[var(--nh-red)]" role="alert">{notice}</p> : null}
      <section aria-labelledby="security-identities-title" className="space-y-3">
        <h3 className="text-base font-medium text-[var(--nh-ink)]" id="security-identities-title">Phương thức đăng nhập</h3>
        <ul className="space-y-3">
          {currentSecurity.identities.map((identity) => (
            <li className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--nh-ink)]" key={`${identity.provider}:${identity.maskedIdentifier}`}>
              <span>{identity.maskedIdentifier} · Đã xác minh</span>
              <button className={buttonClassName} onClick={() => unlink(unlinkAction(identity.provider))} type="button">Gỡ</button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="security-sessions-title" className="space-y-3 border-t border-[var(--nh-border)] pt-6">
        <h3 className="text-base font-medium text-[var(--nh-ink)]" id="security-sessions-title">Phiên đăng nhập</h3>
        <p className="text-sm text-[var(--nh-muted)]">Số phiên hiện có: {currentSecurity.sessionCount}</p>
        <div className="flex flex-wrap gap-3"><button className={buttonClassName} onClick={() => void request("/api/account/security/logout-current")} type="button">Đăng xuất phiên này</button><button className={buttonClassName} onClick={() => window.confirm("Đăng xuất khỏi tất cả phiên?") && void request("/api/account/security/revoke-all")} type="button">Đăng xuất tất cả phiên</button></div>
      </section>
      <section aria-labelledby="security-deletion-title" className="space-y-3 border-t border-[var(--nh-border)] pt-6">
        <h3 className="text-base font-medium text-[var(--nh-ink)]" id="security-deletion-title">Xóa tài khoản</h3>
        <p className="text-sm text-[var(--nh-muted)]">Nhập DELETE để xác nhận sau khi bắt đầu quy trình xóa.</p>
        <label className="block text-sm text-[var(--nh-ink)]" htmlFor="delete-confirmation">Xác nhận xóa</label>
        <input className="min-h-11 w-full border border-[var(--nh-border)] px-3" id="delete-confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
        <div className="flex flex-wrap gap-3"><button className={buttonClassName} onClick={beginDeletion} type="button">Bắt đầu xóa tài khoản</button><button className={buttonClassName} disabled={confirmation !== "DELETE"} onClick={confirmDeletion} type="button">Xác nhận xóa</button></div>
      </section>
    </div>
  );
}
