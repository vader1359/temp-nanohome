"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/components/auth/auth-provider";
import { isSupportedLocale, type Locale } from "@/i18n/routing";
import type { PersonalizationMode, PreferenceFeature, RecentEntity } from "@/lib/personalization";
import { PreferenceCenter, type PreferenceCenterCopy } from "./preference-center";
import { RecentlyViewedList, type RecentlyViewedCopy } from "./recently-viewed-list";

type CustomerPersonalizationPayload = {
  readonly enabled: boolean;
  readonly consent: boolean;
  readonly mode: PersonalizationMode;
  readonly preferences: readonly PreferenceFeature[];
  readonly recent: readonly RecentEntity[];
  readonly memoryConnected: boolean;
  readonly memorySummary: string | null;
};

type PanelCopy = {
  readonly sectionTitle: string;
  readonly sectionBody: string;
  readonly defaultTitle: string;
  readonly defaultBody: string;
  readonly loading: string;
  readonly memoryTitle: string;
  readonly preference: PreferenceCenterCopy;
  readonly recent: RecentlyViewedCopy;
};

const copyByLocale: Readonly<Record<Locale, PanelCopy>> = {
  vi: {
    sectionTitle: "Dành riêng cho bạn",
    sectionBody: "Các gợi ý chỉ sử dụng dữ liệu bạn đã đồng ý cho phép.",
    defaultTitle: "Một tuyển chọn nhẹ nhàng cho không gian của bạn",
    defaultBody: "Bạn vẫn có thể khám phá các lựa chọn biên tập mà không cần cá nhân hóa.",
    loading: "Đang tải lựa chọn của bạn…",
    memoryTitle: "Ghi nhớ tư vấn đã xác nhận",
    preference: {
      defaultTitle: "Một tuyển chọn cho ngôi nhà của bạn",
      defaultBody: "Khám phá các lựa chọn biên tập bất cứ khi nào bạn muốn.",
      title: "Sở thích của bạn",
      body: "Những lựa chọn bạn đã đồng ý lưu.",
      disable: "Tắt",
      edit: "Sửa",
      empty: "Chưa có sở thích nào được lưu.",
      reset: "Đặt lại sở thích",
      disconnectMemory: "Ngắt ghi nhớ khách hàng",
      enabledAnnouncement: "Cá nhân hóa đang được bật.",
    },
    recent: {
      title: "Sản phẩm vừa xem",
      defaultBody: "Các lựa chọn biên tập vẫn luôn sẵn sàng để bạn khám phá.",
      empty: "Chưa có sản phẩm nào.",
      remove: "Xóa",
    },
  },
  en: {
    sectionTitle: "Selected for you",
    sectionBody: "Suggestions use only the information you have agreed to share.",
    defaultTitle: "A considered selection for your home",
    defaultBody: "You can continue with our curated edit without personalization.",
    loading: "Loading your selection…",
    memoryTitle: "Confirmed consultation memory",
    preference: {
      defaultTitle: "A considered selection for your home",
      defaultBody: "Browse our curated edit whenever you are ready.",
      title: "Your preferences",
      body: "The choices you have agreed to save.",
      disable: "Disable",
      edit: "Edit",
      empty: "No saved preferences yet.",
      reset: "Reset preferences",
      disconnectMemory: "Disconnect customer memory",
      enabledAnnouncement: "Personalization is enabled.",
    },
    recent: {
      title: "Recently viewed",
      defaultBody: "Our curated edit is always ready to explore.",
      empty: "Nothing here yet.",
      remove: "Remove",
    },
  },
  ko: {
    sectionTitle: "나를 위한 셀렉션",
    sectionBody: "동의한 정보만 사용해 추천을 구성합니다.",
    defaultTitle: "공간을 위한 차분한 셀렉션",
    defaultBody: "개인화 없이도 큐레이션 상품을 둘러볼 수 있습니다.",
    loading: "맞춤 셀렉션을 불러오는 중…",
    memoryTitle: "확인된 상담 기록",
    preference: {
      defaultTitle: "공간을 위한 셀렉션",
      defaultBody: "원할 때 언제든 큐레이션 상품을 둘러보세요.",
      title: "나의 선호",
      body: "저장에 동의한 선택입니다.",
      disable: "끄기",
      edit: "수정",
      empty: "저장된 선호가 없습니다.",
      reset: "선호 초기화",
      disconnectMemory: "고객 기억 연결 해제",
      enabledAnnouncement: "개인화가 활성화되었습니다.",
    },
    recent: {
      title: "최근 본 상품",
      defaultBody: "큐레이션 상품을 언제든 둘러볼 수 있습니다.",
      empty: "아직 본 상품이 없습니다.",
      remove: "삭제",
    },
  },
};

export function CustomerPersonalizationPanel({ locale }: { readonly locale: string }) {
  const { isAuthenticated } = useAuthContext();
  const [payload, setPayload] = useState<CustomerPersonalizationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const effectiveLocale = isSupportedLocale(locale) ? locale : "vi";
  const copy = copyByLocale[effectiveLocale];

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      // Keep state transitions asynchronous to the effect itself, and clear
      // account-scoped data before starting a new authenticated request.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setPayload(null);
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const contextResponse = await fetch("/api/customer/context", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!contextResponse.ok) throw new Error("Customer context unavailable");
      const response = await fetch(`/api/customer/personalization?locale=${effectiveLocale}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Customer personalization unavailable");
      setPayload(await response.json() as CustomerPersonalizationPayload);
    };
    void load().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setPayload(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [effectiveLocale, isAuthenticated]);

  if (!isAuthenticated) return null;

  if (loading) {
    return <p className="mx-auto w-full max-w-[1320px] px-6 py-10 text-sm text-[var(--nh-muted)]" role="status">{copy.loading}</p>;
  }

  if (payload === null || !payload.enabled || !payload.consent) {
    return (
      <section className="mx-auto w-full max-w-[1320px] px-6 py-10" aria-labelledby="customer-personalization-default-title">
        <div className="border border-[var(--nh-border)] bg-[var(--nh-surface-warm)] p-6">
          <h2 id="customer-personalization-default-title" className="text-lg text-[var(--nh-ink)]">{copy.defaultTitle}</h2>
          <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.defaultBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1320px] px-6 py-12" aria-labelledby="customer-personalization-title">
      <h2 id="customer-personalization-title" className="text-2xl text-[var(--nh-ink)]">{copy.sectionTitle}</h2>
      <p className="mt-2 text-sm text-[var(--nh-muted)]">{copy.sectionBody}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PreferenceCenter consent preferences={payload.preferences} copy={copy.preference} />
        <RecentlyViewedList consent recent={payload.recent} labels={{}} copy={copy.recent} />
      </div>
      {payload.memoryConnected && payload.memorySummary !== null ? (
        <div className="mt-4 border border-[var(--nh-border)] bg-[var(--nh-surface-primary)] p-6">
          <h3 className="text-sm font-medium text-[var(--nh-ink)]">{copy.memoryTitle}</h3>
          <p className="mt-2 text-sm text-[var(--nh-muted)]">{payload.memorySummary}</p>
        </div>
      ) : null}
    </section>
  );
}
