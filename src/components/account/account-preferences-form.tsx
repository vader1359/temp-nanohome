"use client";

import { useState } from "react";

import {
  parseAccountPreferencesResponse,
  type AccountPreferences,
} from "@/lib/account/preferences-schema";

type AccountPreferencesFormProps = {
  readonly preferences: AccountPreferences;
};

type PreferenceToggle = "browsingHistoryEnabled" | "productPersonalizationEnabled";

export function AccountPreferencesForm({ preferences }: AccountPreferencesFormProps) {
  const [currentPreferences, setCurrentPreferences] = useState(preferences);
  const [notice, setNotice] = useState("");

  async function replaceFromResponse(response: Response) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      setNotice("Không thể cập nhật tùy chọn lúc này.");
      return;
    }

    const nextPreferences = parseAccountPreferencesResponse(body);
    if (nextPreferences === null) {
      setNotice("Không thể cập nhật tùy chọn lúc này.");
      return;
    }

    setCurrentPreferences(nextPreferences);
    setNotice("");
  }

  async function updateToggle(toggle: PreferenceToggle) {
    const nextValue = !currentPreferences[toggle];
    try {
      const response = await fetch("/api/account/preferences", {
        body: JSON.stringify({ [toggle]: nextValue }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      await replaceFromResponse(response);
    } catch {
      setNotice("Không thể cập nhật tùy chọn lúc này.");
    }
  }

  async function runConfirmedAction(message: string, path: string) {
    if (!window.confirm(message)) return;

    try {
      const response = await fetch(path, { method: "POST" });
      if (response.status === 409) {
        setNotice("Cần xác thực lại trước khi thực hiện thao tác này.");
        return;
      }
      await replaceFromResponse(response);
    } catch {
      setNotice("Không thể cập nhật tùy chọn lúc này.");
    }
  }

  return (
    <div className="mt-6 space-y-6 border-t border-[var(--nh-border)] pt-6">
      {notice ? <p aria-live="polite" className="text-sm text-[var(--nh-red)]" role="alert">{notice}</p> : null}
      <fieldset className="space-y-4">
        <legend className="text-base font-medium text-[var(--nh-ink)]">Cá nhân hóa</legend>
        <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-[var(--nh-ink)]">
          Cá nhân hóa sản phẩm
          <input aria-label="Cá nhân hóa sản phẩm" checked={currentPreferences.productPersonalizationEnabled} className="size-5 accent-[var(--nh-accent)]" onChange={() => void updateToggle("productPersonalizationEnabled")} type="checkbox" />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-[var(--nh-ink)]">
          Lưu lịch sử duyệt web
          <input aria-label="Lưu lịch sử duyệt web" checked={currentPreferences.browsingHistoryEnabled} className="size-5 accent-[var(--nh-accent)]" onChange={() => void updateToggle("browsingHistoryEnabled")} type="checkbox" />
        </label>
      </fieldset>

      <section aria-labelledby="amis-history-title" className="space-y-3 border-t border-[var(--nh-border)] pt-6">
        <h3 className="text-base font-medium text-[var(--nh-ink)]" id="amis-history-title">Lịch sử AMIS</h3>
        <p className="text-sm text-[var(--nh-muted)]">{currentPreferences.amisHistory.available ? "AMIS history is available" : "Lịch sử AMIS không khả dụng"}</p>
        <div className="flex flex-wrap gap-3">
          <button className="min-h-11 border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => void runConfirmedAction("Đặt lại lịch sử AMIS?", "/api/account/preferences/reset-amis")} type="button">Đặt lại lịch sử AMIS</button>
          <button className="min-h-11 border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => void runConfirmedAction("Ngắt kết nối AMIS?", "/api/account/preferences/disconnect-amis")} type="button">Ngắt kết nối AMIS</button>
        </div>
      </section>

      <section aria-labelledby="recommendation-data-title" className="space-y-3 border-t border-[var(--nh-border)] pt-6">
        <h3 className="text-base font-medium text-[var(--nh-ink)]" id="recommendation-data-title">Dữ liệu đề xuất</h3>
        <p className="text-sm text-[var(--nh-muted)]">Trạng thái: {currentPreferences.recommendationDataState === "available" ? "sẵn sàng" : "đã xóa"}</p>
        <button className="min-h-11 border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => void runConfirmedAction("Xóa dữ liệu đề xuất?", "/api/account/preferences/clear-recommendation-data")} type="button">Xóa dữ liệu đề xuất</button>
      </section>
    </div>
  );
}
