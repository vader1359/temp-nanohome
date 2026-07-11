"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart, type CartItem } from "@/components/cart/cart-context";

type CheckoutStatus = "idle" | "submitting" | "success" | "error";

type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
};

const initialForm: CheckoutForm = { email: "", name: "", phone: "" };

export function CheckoutPage() {
  const t = useTranslations("Checkout");
  const { items, clearCart } = useCart();
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [payment, setPayment] = useState("zalopay");
  const [coupon, setCoupon] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState("");

  const total = items.reduce((sum, item) => sum + parseCartPrice(item.price) * item.quantity, 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0 || status === "submitting") return;

    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !agreed) {
      setError(t("validationRequired"));
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError("");
    try {
      const response = await fetch("/api/cart/submit", {
        body: JSON.stringify({
          cartItems: items.map((item) => ({ ...item, lineTotal: parseCartPrice(item.price) * item.quantity })),
          email: form.email.trim(),
          name: form.name.trim(),
          pageUrl: window.location.href,
          phone: form.phone.trim(),
          source: "nanohome-checkout",
          total,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data: unknown = await response.json();
      if (!response.ok || !isSuccessfulResponse(data)) {
        throw new Error(t("serverError"));
      }
      clearCart();
      setStatus("success");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("serverError"));
      setStatus("error");
    }
  };

  if (items.length === 0 && status !== "success") {
    return (
      <main className="min-h-[60vh] bg-[var(--nh-surface-warm)] px-4 py-16 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl border border-[var(--nh-border)] bg-white p-8 text-center sm:p-12">
          <h1 className="text-2xl text-nh-ink">{t("emptyTitle")}</h1>
          <p className="mt-3 text-sm text-nh-muted">{t("emptyDescription")}</p>
          <Link href="/products" className="mt-8 inline-flex bg-nh-ink px-6 py-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent">{t("continueShopping")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] bg-[var(--nh-surface-warm)] px-4 py-12 sm:px-6 lg:px-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-normal text-nh-ink">{status === "success" ? t("successTitle") : t("title")}</h1>
        {status === "success" ? (
          <section className="mt-8 border border-[var(--nh-border)] bg-white p-8 sm:p-12" aria-live="polite">
            <p className="text-base text-nh-muted">{t("successDescription")}</p>
          </section>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
            <form onSubmit={submit} className="border border-[var(--nh-border)] bg-white p-6 sm:p-8">
              <h2 className="text-xl text-nh-ink">{t("details")}</h2>
              <div className="mt-6 grid gap-5">
                {(["name", "phone", "email"] as const).map((field) => (
                  <label key={field} htmlFor={`checkout-${field}`} className="grid gap-2 text-sm text-nh-ink">
                    <span>{t(field)} <span aria-hidden="true">*</span></span>
                    <input id={`checkout-${field}`} required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="h-12 border border-[var(--nh-border)] px-3 outline-none focus:border-nh-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} />
                  </label>
                ))}
                <div className="grid gap-2">
                  <label htmlFor="checkout-coupon" className="text-sm text-nh-ink">{t("coupon")}</label>
                  <input id="checkout-coupon" aria-describedby="checkout-coupon-notice" value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder={t("couponPlaceholder")} className="h-12 border border-[var(--nh-border)] px-3 outline-none focus:border-nh-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" type="text" />
                  <p id="checkout-coupon-notice" className="text-xs leading-5 text-nh-muted">{t("couponNotice")}</p>
                </div>
              </div>
              <fieldset className="mt-8 grid gap-3">
                <legend className="text-sm text-nh-ink">{t("payment")}</legend>
                {(["zalopay", "vnpay"] as const).map((method) => (
                  <label key={method} className="flex items-center gap-3 text-sm text-nh-ink">
                     <input type="radio" name="payment" value={method} checked={payment === method} onChange={() => setPayment(method)} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" />
                     {t(method)}
                   </label>
                 ))}
                 <p className="text-xs leading-5 text-nh-muted">{t("paymentNotice")}</p>
               </fieldset>
               <label className="mt-8 flex items-start gap-3 text-sm text-nh-ink">
                 <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" />
                <span>{t("agreement")} <span aria-hidden="true">*</span></span>
              </label>
              <p className="mt-5 min-h-5 text-sm text-nh-red" aria-live="polite">{status === "error" ? error : ""}</p>
               <button type="submit" disabled={status === "submitting"} className="mt-4 h-12 w-full bg-nh-ink text-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent disabled:cursor-not-allowed disabled:opacity-50">{status === "submitting" ? t("submitting") : t("submit")}</button>
            </form>
            <aside className="border border-[var(--nh-border)] bg-white p-6 sm:p-8">
              <h2 className="text-xl text-nh-ink">{t("summary")}</h2>
              <div className="mt-6 grid gap-5">
                {items.map((item) => <CheckoutItem key={item.id} item={item} />)}
              </div>
              <div className="mt-8 flex justify-between border-t border-[var(--nh-border)] pt-5 text-base text-nh-ink"><span>{t("total")}</span><span>{formatVnd(total)}</span></div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function CheckoutItem({ item }: { item: CartItem }) {
  return <div className="flex justify-between gap-4 text-sm text-nh-muted"><span>{item.name} × {item.quantity}</span><span className="shrink-0 text-nh-ink">{formatVnd(parseCartPrice(item.price) * item.quantity)}</span></div>;
}

function parseCartPrice(price: string): number {
  const numeric = Number(price.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function isSuccessfulResponse(value: unknown): value is { ok: true } {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
}
