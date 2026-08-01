"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

/**
 * SePay error redirect page.
 * 
 * Displays when payment gateway returns an error.
 * User can retry with the same order.
 */
export default function SePayErrorPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const orderId = searchParams.get("orderId");
  const t = useTranslations("Checkout");

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl">{t("paymentErrorTitle")}</h1>
      <p className="mt-4">{t("paymentErrorDescription")}</p>
      {orderId && (
        <div className="mt-8 flex flex-wrap gap-5">
          <a className="underline" href={`/${locale}/account/orders/${orderId}`}>{t("viewOrder")}</a>
          <a className="underline" href={`/${locale}/checkout?orderId=${encodeURIComponent(orderId)}`}>{t("retryPayment")}</a>
        </div>
      )}
    </main>
  );
}
