"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

/**
 * SePay cancel redirect page.
 * 
 * User explicitly cancelled or left the payment gateway.
 * Browser departure alone is not cancellation - order remains valid for retry.
 */
export default function SePayCancelPage() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const orderId = searchParams.get("orderId");
  const t = useTranslations("Checkout");

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl">{t("cancelTitle")}</h1>
      <p className="mt-4">{t("cancelDescription")}</p>
      {orderId && (
        <div className="mt-8 flex flex-wrap gap-5">
          <a className="underline" href={`/${locale}/account/orders/${orderId}`}>{t("viewOrder")}</a>
          <a className="underline" href={`/${locale}/checkout?orderId=${encodeURIComponent(orderId)}`}>{t("retryPayment")}</a>
        </div>
      )}
    </main>
  );
}
