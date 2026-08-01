"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * SePay success redirect page.
 * 
 * CRITICAL: This page NEVER marks an order paid from URL params.
 * It queries /api/orders/[orderId]/payment-status for server state.
 * 
 * Foundation prerequisite: payment-status route with owner authorization.
 */
export default function SePaySuccessPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("Checkout");
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">(
    orderId ? "loading" : "error",
  );

  useEffect(() => {
    if (!orderId) return;

    let active = true;
    const timer = window.setInterval(() => void checkStatus(), 2_500);
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment-status`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("payment_status_unavailable");
        const data: unknown = await response.json();
        if (!active || typeof data !== "object" || data === null || !("paymentState" in data)) return;
        if (data.paymentState === "paid") {
          active = false;
          window.clearInterval(timer);
          setStatus("paid");
        } else if (data.paymentState === "failed") {
          active = false;
          window.clearInterval(timer);
          setStatus("error");
        } else {
          setStatus("pending");
        }
      } catch {
        if (active) setStatus("error");
      }
    };
    void checkStatus();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [orderId]);

  if (status === "loading") {
    return <main className="mx-auto max-w-2xl px-6 py-20" aria-live="polite">{t("paymentStatusChecking")}</main>;
  }

  if (status === "paid") {
    return <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl">{t("successTitle")}</h1>
      <p className="mt-4">{t("successDescription")}</p>
      {orderId ? <a className="mt-8 inline-flex underline" href={`/${locale}/account/orders/${orderId}`}>{t("viewOrder")}</a> : null}
    </main>;
  }

  if (status === "pending") {
    return <main className="mx-auto max-w-2xl px-6 py-20" aria-live="polite">
      <h1 className="text-3xl">{t("pendingVerification")}</h1>
      <p className="mt-4">{t("paymentPendingDescription")}</p>
    </main>;
  }

  return <main className="mx-auto max-w-2xl px-6 py-20">
    <h1 className="text-3xl">{t("paymentErrorTitle")}</h1>
    <p className="mt-4">{t("paymentStatusError")}</p>
    {orderId ? <a className="mt-8 inline-flex underline" href={`/${locale}/account/orders/${orderId}`}>{t("viewOrder")}</a> : null}
  </main>;
}
