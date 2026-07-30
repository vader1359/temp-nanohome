"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AccountCart } from "@/lib/account/cart-port";
import { cartCheckoutReadiness } from "@/lib/checkout/cart-readiness";
import type { CheckoutIdentity } from "@/lib/checkout/checkout-identity";
import {
  isExpectedSePayTestVietQrUrl,
  isSePayTestPaymentReference,
} from "@/lib/payments/sepay/checkout";

type CheckoutStatus = "idle" | "submitting" | "payment_pending" | "error";

type CheckoutForm = Readonly<{
  address: string;
  name: string;
  phone: string;
  email: string;
}>;

type CheckoutPageProps = Readonly<{
  initialAccountCart: AccountCart;
  checkoutIdentity: CheckoutIdentity;
  initialFullName?: string;
  locale?: string;
}>;

type OrderResponse = Readonly<{
  orderId: string;
  orderNumber: string;
  replayed: boolean;
  next: "initialize_payment";
}>;

type PaymentResponse = Readonly<{
  payment: Readonly<{
    amount: number;
    attemptId: string;
    currency: "VND";
    environment: "sandbox";
    expiresAt: string;
    handoff: "vietqr";
    merchantReference: string;
    paymentUrl: string;
    state: "pending";
  }>;
}>;

export function CheckoutPage({
  checkoutIdentity,
  initialAccountCart,
  initialFullName = "",
  locale = "vi",
}: CheckoutPageProps) {
  const t = useTranslations("Checkout");
  const readiness = cartCheckoutReadiness(initialAccountCart);
  const [form, setForm] = useState<CheckoutForm>({
    address: "",
    email: checkoutIdentity.verifiedEmail,
    name: initialFullName,
    phone: checkoutIdentity.verifiedPhoneE164,
  });
  const [vatRequested, setVatRequested] = useState(false);
  const [vatCompanyName, setVatCompanyName] = useState("");
  const [vatTaxCode, setVatTaxCode] = useState("");
  const [vatInvoiceAddress, setVatInvoiceAddress] = useState("");
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<PaymentResponse["payment"] | null>(null);
  const checkoutIdempotencyKey = useRef<string | null>(null);
  const paymentIdempotencyKey = useRef<string | null>(null);

  const items = initialAccountCart.items.map((item) => ({
    badge: item.available ? "In stock" : "Unavailable",
    badgeTone: "stock" as const,
    category: "nanoHome",
    id: item.variantId,
    image: "/images/p_lc2.png",
    name: item.title,
    price: String(item.unitPrice.amount),
    quantity: item.quantity,
  }));
  const total = items.reduce((sum, item) => sum + item.quantity * parseCartPrice(item.price), 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || status === "payment_pending") return;

    if (readiness.kind !== "ready") {
      setError(readiness.kind === "stock_changed"
        ? t("checkoutStockChanged")
        : t("checkoutUnavailableCart"));
      setStatus("error");
      return;
    }
    if (!form.name.trim() || !form.address.trim()) {
      setError(t("validationRequired"));
      setStatus("error");
      return;
    }
    if (vatRequested && (!vatCompanyName.trim() || !vatTaxCode.trim() || !vatInvoiceAddress.trim())) {
      setError(t("validationRequired"));
      setStatus("error");
      return;
    }

    checkoutIdempotencyKey.current ??= crypto.randomUUID();
    paymentIdempotencyKey.current ??= crypto.randomUUID();
    setError("");
    setStatus("submitting");

    try {
      const checkoutResponse = await fetch("/api/checkout", {
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotencyKey.current,
          delivery: {
            address: form.address.trim(),
            addressId: null,
            fullName: form.name.trim(),
          },
          vat: vatRequested
            ? {
                address: vatInvoiceAddress.trim(),
                companyName: vatCompanyName.trim(),
                taxCode: vatTaxCode.trim(),
              }
            : null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const checkoutData: unknown = await checkoutResponse.json();
      if (!checkoutResponse.ok || !isOrderResponse(checkoutData)) {
        throw new Error(checkoutErrorMessage(apiErrorCode(checkoutData), t));
      }

      const paymentResponse = await fetch(
        `/api/orders/${checkoutData.orderId}/payments/sepay`,
        {
          body: JSON.stringify({
            idempotencyKey: paymentIdempotencyKey.current,
            returnUrlsVersion: "v1",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const paymentData: unknown = await paymentResponse.json();
      if (!paymentResponse.ok || !isPaymentResponse(paymentData)) {
        throw new Error(paymentErrorMessage(apiErrorCode(paymentData), t));
      }

      setPayment(paymentData.payment);
      setStatus("payment_pending");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("serverError"));
      setStatus("error");
    }
  }

  if (readiness.kind === "empty") {
    return (
      <main className="min-h-[60vh] bg-white px-4 py-16 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl border border-[#E5E5E5] bg-white p-8 text-center sm:p-12">
          <h1 className="text-2xl text-[#1A1A1A]">{t("emptyTitle")}</h1>
          <p className="mt-3 text-sm text-[#666666]">{t("emptyDescription")}</p>
          <Link className="mt-8 inline-flex bg-[#1A1A1A] px-6 py-3 text-sm text-white" href="/products">
            {t("continueShopping")}
          </Link>
        </div>
      </main>
    );
  }

  if (status === "payment_pending" && payment !== null) {
    return (
      <main className="min-h-[60vh] bg-white px-4 py-16 sm:px-6 lg:px-12">
        <section aria-live="polite" className="mx-auto max-w-3xl border border-[#E5E5E5] p-8 text-center sm:p-12">
          <h1 className="text-2xl text-[#1A1A1A]">{t("sepayQrTitle")}</h1>
          <p className="mt-3 text-sm text-[#666666]">{t("sepayQrInstructions")}</p>
          <img
            alt={t("sepayQrAlt")}
            className="mx-auto mt-8 w-full max-w-md"
            src={payment.paymentUrl}
          />
          <dl className="mx-auto mt-8 grid max-w-md gap-4 border-t border-[#E5E5E5] pt-6 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#666666]">{t("total")}</dt>
              <dd className="font-medium text-[#1A1A1A]">{formatVnd(payment.amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#666666]">{t("paymentReference")}</dt>
              <dd className="font-mono font-medium text-[#1A1A1A]">{payment.merchantReference}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-[#666666]">{t("sepayTestPending")}</p>
          <p className="mt-2 text-xs font-medium text-[#B54708]">{t("sepayQrTestOnly")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] bg-white px-4 py-8 pb-32 sm:px-6 lg:px-12">
      <div className="mx-auto grid max-w-[1540px] gap-6 lg:grid-cols-2">
        <section className="border border-[#E5E5E5] bg-white p-6 sm:p-8">
          <h1 className="text-2xl text-[#1A1A1A]">{t("title")}</h1>
          <h2 className="mt-8 text-xl text-[#1A1A1A]">{t("details")}</h2>
          <form className="mt-6 flex flex-col gap-6" data-testid="checkout-form" onSubmit={submit}>
            <label className="grid gap-2 text-sm text-[#666666]" htmlFor="checkout-name">
              {t("name")} <span aria-hidden="true">*</span>
              <input
                className="min-h-11 border-b border-[#E5E5E5] bg-transparent px-1 text-base text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                disabled={status === "submitting"}
                id="checkout-name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label className="grid gap-2 text-sm text-[#666666]" htmlFor="checkout-email">
              {t("email")}
              <input
                aria-readonly="true"
                className="min-h-11 border-b border-[#E5E5E5] bg-[#FAFAFA] px-1 text-base text-[#666666] outline-none"
                id="checkout-email"
                readOnly
                value={form.email}
              />
            </label>
            <div className="grid gap-2 text-sm text-[#666666]">
              <label htmlFor="checkout-phone">{t("phone")}</label>
              <input
                aria-readonly="true"
                className="min-h-11 border-b border-[#E5E5E5] bg-[#FAFAFA] px-1 text-base text-[#666666] outline-none"
                id="checkout-phone"
                readOnly
                value={form.phone}
              />
              <Link
                className="text-xs text-[#666666] underline underline-offset-4"
                href={`/account/sign-in?returnTo=${encodeURIComponent(`/${locale}/checkout`)}`}
              >
                {t("changeVerifiedPhone")}
              </Link>
              <p className="text-xs leading-5 text-[#666666]">
                {t("verifiedContactNotice")}
              </p>
            </div>
            <label className="grid gap-2 text-sm text-[#666666]" htmlFor="checkout-address">
              {t("address")} <span aria-hidden="true">*</span>
              <textarea
                className="min-h-28 border border-[#E5E5E5] bg-transparent p-3 text-base text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                disabled={status === "submitting"}
                id="checkout-address"
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
                value={form.address}
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-[#1A1A1A]">
              <input
                checked={vatRequested}
                disabled={status === "submitting"}
                onChange={(event) => setVatRequested(event.target.checked)}
                type="checkbox"
              />
              {t("vatInvoice")}
            </label>
            {vatRequested ? (
              <div className="grid gap-3">
                <input aria-label="VAT company" className="border-b border-[#E5E5E5] p-2" onChange={(event) => setVatCompanyName(event.target.value)} placeholder="Tên công ty xuất hóa đơn" value={vatCompanyName} />
                <input aria-label="VAT tax code" className="border-b border-[#E5E5E5] p-2" onChange={(event) => setVatTaxCode(event.target.value)} placeholder="Mã số thuế" value={vatTaxCode} />
                <input aria-label="VAT address" className="border-b border-[#E5E5E5] p-2" onChange={(event) => setVatInvoiceAddress(event.target.value)} placeholder="Địa chỉ xuất hóa đơn" value={vatInvoiceAddress} />
              </div>
            ) : null}
            <button
              className="min-h-12 bg-[#1A1A1A] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#CCCCCC]"
              disabled={status === "submitting" || readiness.kind !== "ready"}
              type="submit"
            >
              {status === "submitting" ? t("submitting") : t("submit")}
            </button>
            {status === "error" ? <p aria-live="polite" className="text-sm text-[#FF4D4F]" role="alert">{error}</p> : null}
          </form>
        </section>

        <section className="border border-[#E5E5E5] bg-white p-6 sm:p-8">
          <h2 className="text-xl text-[#1A1A1A]">{t("summary")}</h2>
          {readiness.kind === "unavailable_items" ? (
            <div className="mt-6 border border-[#FF4D4F] bg-[#FFF8F8] p-4 text-sm text-[#1A1A1A]" role="alert">
              <p className="font-medium">{t("checkoutUnavailableCart")}</p>
              <ul className="mt-2 list-disc pl-5 text-[#666666]">
                {readiness.unavailableItems.map((item) => <li key={item.variantId}>{item.title}</li>)}
              </ul>
              <Link className="mt-3 inline-flex underline" href="/account/cart">{t("checkoutGoToCart")}</Link>
            </div>
          ) : null}
          {readiness.kind === "stock_changed" ? (
            <div className="mt-6 border border-[#FF4D4F] bg-[#FFF8F8] p-4 text-sm text-[#1A1A1A]" role="alert">
              <p className="font-medium">{t("checkoutStockChanged")}</p>
              <ul className="mt-2 list-disc pl-5 text-[#666666]">
                {readiness.changedItems.map((item) => <li key={item.variantId}>{item.title}</li>)}
              </ul>
              <Link className="mt-3 inline-flex underline" href="/account/cart">{t("checkoutGoToCart")}</Link>
            </div>
          ) : null}
          <ul className="mt-6 divide-y divide-[#E5E5E5]">
            {items.map((item) => <CheckoutItem item={item} key={item.id} />)}
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-[#E5E5E5] pt-6 text-base text-[#1A1A1A]">
            <span>{t("total")}</span>
            <strong>{formatVnd(total)}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}

function CheckoutItem({ item }: Readonly<{ item: Readonly<{ badge: string; category: string; id: string; image: string; name: string; price: string; quantity: number }> }>) {
  return (
    <li className="flex gap-4 py-5">
      <img alt="" className="h-20 w-20 border border-[#E5E5E5] object-contain p-2" src={item.image} />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-[#1A1A1A]">{item.name}</h3>
          <p className="mt-1 text-xs text-[#666666]">{item.category} · x{item.quantity}</p>
          {item.badge === "Unavailable" ? <p className="mt-1 text-xs text-[#FF4D4F]">{item.badge}</p> : null}
        </div>
        <span className="shrink-0 text-sm font-medium text-[#1A1A1A]">{formatVnd(parseCartPrice(item.price) * item.quantity)}</span>
      </div>
    </li>
  );
}

function parseCartPrice(price: string): number {
  const numeric = Number(price.replace(/[^\d]/gu, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function isOrderResponse(value: unknown): value is OrderResponse {
  return typeof value === "object"
    && value !== null
    && "orderId" in value
    && typeof value.orderId === "string"
    && "orderNumber" in value
    && typeof value.orderNumber === "string"
    && "replayed" in value
    && typeof value.replayed === "boolean"
    && "next" in value
    && value.next === "initialize_payment";
}

function apiErrorCode(value: unknown): string | null {
  return typeof value === "object"
    && value !== null
    && "error" in value
    && typeof value.error === "string"
    ? value.error
    : null;
}

function checkoutErrorMessage(errorCode: string | null, t: (key: string) => string): string {
  switch (errorCode) {
    case "identity_required": return t("identityRequired");
    case "invalid_checkout_data": return t("validationRequired");
    case "checkout_empty_cart": return t("checkoutEmptyCart");
    case "checkout_invalid_cart": return t("checkoutUnavailableCart");
    case "checkout_cart_not_found": return t("checkoutCartNotFound");
    case "checkout_idempotency_conflict": return t("checkoutRetry");
    default: return t("serverError");
  }
}

function paymentErrorMessage(errorCode: string | null, t: (key: string) => string): string {
  switch (errorCode) {
    case "payment_already_paid":
    case "payment_expired":
    case "payment_not_payable":
    case "payment_idempotency_conflict":
      return t("paymentRetry");
    default: return t("paymentError");
  }
}

function isPaymentResponse(value: unknown): value is PaymentResponse {
  if (typeof value !== "object" || value === null || !("payment" in value)) return false;
  const payment = value.payment;
  if (typeof payment !== "object" || payment === null) return false;
  if (!("amount" in payment)
    || typeof payment.amount !== "number"
    || !Number.isSafeInteger(payment.amount)
    || payment.amount <= 0
    || !("merchantReference" in payment)
    || typeof payment.merchantReference !== "string"
    || !isSePayTestPaymentReference(payment.merchantReference)
    || !("paymentUrl" in payment)
    || typeof payment.paymentUrl !== "string"
    || !isExpectedSePayTestVietQrUrl(payment.paymentUrl, {
      amount: payment.amount,
      merchantReference: payment.merchantReference,
    })) return false;
  return "attemptId" in payment
    && typeof payment.attemptId === "string"
    && "currency" in payment
    && payment.currency === "VND"
    && "environment" in payment
    && payment.environment === "sandbox"
    && "expiresAt" in payment
    && typeof payment.expiresAt === "string"
    && !Number.isNaN(Date.parse(payment.expiresAt))
    && "handoff" in payment
    && payment.handoff === "vietqr"
    && "state" in payment
    && payment.state === "pending";
}
