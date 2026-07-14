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
  const { items, removeItem, updateQuantity } = useCart();
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [vatRequested, setVatRequested] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState("");

  // Selection state is tracking unselected items (inverse). Default all selected.
  const [unselectedIds, setUnselectedIds] = useState<Set<string>>(new Set());

  // Derive active selections
  const selectedItems = items.filter((item) => !unselectedIds.has(item.id));
  const isAllSelected = selectedItems.length === items.length && items.length > 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setUnselectedIds(new Set(items.map((i) => i.id)));
    } else {
      setUnselectedIds(new Set());
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(unselectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setUnselectedIds(next);
  };

  const total = selectedItems.reduce((sum, item) => sum + parseCartPrice(item.price) * item.quantity, 0);
  const originalTotal = selectedItems.reduce((sum, item) => sum + parseCartPrice(item.originalPrice || item.price) * item.quantity, 0);
  const savings = Math.max(0, originalTotal - total);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0 || status === "submitting") return;

    if (selectedItems.length === 0) {
      setError(t("validationSelectItems"));
      setStatus("error");
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError(t("validationRequired"));
      setStatus("error");
      return;
    }

    const submittedCartItems = selectedItems.map((item) => ({
      ...item,
      lineTotal: parseCartPrice(item.price) * item.quantity,
    }));
    const submittedIds = submittedCartItems.map((item) => item.id);
    const submittedTotal = submittedCartItems.reduce((sum, item) => sum + item.lineTotal, 0);

    setStatus("submitting");
    setError("");

    try {
      const response = await fetch("/api/cart/submit", {
        body: JSON.stringify({
          cartItems: submittedCartItems,
          email: form.email.trim(),
          name: form.name.trim(),
          pageUrl: window.location.href,
          phone: form.phone.trim(),
          source: "nanohome-checkout",
          total: submittedTotal,
          vatRequested,
          zaloPayRequested: false,
          vnPayRequested: false,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data: unknown = await response.json();
      if (!response.ok || !isSuccessfulResponse(data)) {
        throw new Error(t("serverError"));
      }
      submittedIds.forEach((id) => removeItem(id));
      setStatus("success");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("serverError"));
      setStatus("error");
    }
  };

  if (items.length === 0 && status !== "success") {
    return (
      <main className="min-h-[60vh] bg-white px-4 py-16 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl border border-[#E5E5E5] bg-white p-8 text-center sm:p-12">
          <h1 className="text-2xl text-[#1A1A1A]">{t("emptyTitle")}</h1>
          <p className="mt-3 text-sm text-[#666666]">{t("emptyDescription")}</p>
          <Link href="/products" className="mt-8 inline-flex bg-[#1A1A1A] px-6 py-3 text-sm text-white hover:bg-black transition-colors">{t("continueShopping")}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] bg-white px-4 py-8 sm:px-6 lg:px-12 pb-32 lg:pb-16">
      <div className="mx-auto max-w-[1540px]">
        {status === "success" ? (
          <div className="mx-auto max-w-3xl text-center mt-8">
            <h1 className="text-3xl font-normal text-[#1A1A1A]">{t("successTitle")}</h1>
            <section className="mt-8 border border-[#E5E5E5] bg-white p-8 sm:p-12" aria-live="polite">
              <p className="text-base text-[#666666]">{t("successDescription")}</p>
            </section>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              {/* Shipping Form Card */}
              <div className="border border-[#E5E5E5] bg-white p-6 sm:p-8">
                <h2 className="text-xl text-[#1A1A1A] mb-6">{t("details")}</h2>
                <form id="checkout-form" onSubmit={submit} className="flex flex-col gap-6">
                  {(["name", "phone", "email"] as const).map((field) => (
                    <div key={field} className="relative">
                      <input
                        id={`checkout-${field}`}
                        required
                        value={form[field]}
                        onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                        className="peer w-full border-b border-[#E5E5E5] bg-transparent pb-2 pt-5 text-base text-[#1A1A1A] outline-none placeholder:text-transparent focus:border-[#1A1A1A] disabled:opacity-50"
                        type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                        placeholder={t(field)}
                        disabled={status === "submitting"}
                      />
                      <label
                        htmlFor={`checkout-${field}`}
                        className="absolute left-0 top-1 text-xs text-[#666666] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#1A1A1A]"
                      >
                        {t(field)} <span aria-hidden="true">*</span>
                      </label>
                    </div>
                  ))}

                  <label className="flex items-center gap-3 text-sm text-[#1A1A1A] mt-2 cursor-pointer">
                    <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label="Issue VAT Invoice (Optional)"
                        checked={vatRequested}
                        onChange={(e) => setVatRequested(e.target.checked)}
                        disabled={status === "submitting"}
                        className="peer h-4 w-4 appearance-none rounded-[2px] border border-[#CCCCCC] bg-white checked:border-[#1A1A1A] checked:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      />
                      <svg className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    {t("vatInvoice")}
                  </label>
                </form>
              </div>

              {/* Payment Card */}
              <div className="border border-[#E5E5E5] bg-white p-6 sm:p-8">
                <h2 className="text-xl text-[#1A1A1A] mb-6">{t("payment")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex cursor-not-allowed flex-col border border-[#E5E5E5] bg-[#FAFAFA] p-4 opacity-50">
                     <div className="mb-3 flex items-center justify-between">
                       <input type="radio" name="payment" disabled className="h-4 w-4 cursor-not-allowed appearance-none rounded-full border border-[#CCCCCC] bg-white" />
                       <span className="font-semibold text-[#1A1A1A]">ZaloPay</span>
                     </div>
                     <span className="text-sm text-[#666666]">{t("comingSoon")}</span>
                   </label>

                   <label className="flex cursor-not-allowed flex-col border border-[#E5E5E5] bg-[#FAFAFA] p-4 opacity-50">
                     <div className="mb-3 flex items-center justify-between">
                       <input type="radio" name="payment" disabled className="h-4 w-4 cursor-not-allowed appearance-none rounded-full border border-[#CCCCCC] bg-white" />
                       <span className="font-bold text-[#1A1A1A]">VNPAY</span>
                     </div>
                     <span className="text-sm text-[#666666]">{t("comingSoon")}</span>
                   </label>
                 </div>
                 <p className="mt-4 text-xs leading-5 text-[#666666]">{t("paymentUnavailable")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Cart Card */}
              <div className="border border-[#E5E5E5] bg-white p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl text-[#1A1A1A]">{t("summary")}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label="selectAll"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          disabled={status === "submitting"}
                          className="peer h-4 w-4 appearance-none rounded-[2px] border border-[#CCCCCC] bg-white checked:border-[#1A1A1A] checked:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A] disabled:opacity-50 cursor-pointer"
                        />
                        <svg className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <span className="text-[#666666]">{t("selectAll")}</span>
                    </label>

                  </div>
                </div>

                <div className="flex flex-col">
                  {items.map((item, index) => (
                    <CheckoutItem
                      key={item.id}
                      item={item}
                      selected={!unselectedIds.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                      onUpdateQuantity={updateQuantity}
                      disabled={status === "submitting"}
                      isLast={index === items.length - 1}
                    />
                  ))}
                </div>
              </div>

              {/* Total/Coupon Card */}
              <div className="border border-[#E5E5E5] bg-white p-6 sm:p-8 lg:mb-24">
                <div className="flex gap-2 mb-6 opacity-50 cursor-not-allowed">
                  <input
                    disabled
                    placeholder={t("couponPlaceholder")}
                    className="flex-1 h-12 border border-[#E5E5E5] px-3 text-sm outline-none cursor-not-allowed bg-[#FAFAFA]"
                    type="text"
                  />
                  <button type="button" disabled className="h-12 px-6 bg-[#F4F4F4] text-[#1A1A1A] text-sm border border-[#E5E5E5] cursor-not-allowed">{t("comingSoon")}</button>
                </div>
                <p className="text-xs leading-5 text-[#666666] mb-6">{t("couponUnavailable")}</p>

                <div className="flex flex-col gap-3 text-sm text-[#666666] mb-6 border-b border-[#E5E5E5] pb-6">
                  <div className="flex justify-between">
                    <span>{t("provisional")} ({selectedItems.length})</span>
                    <span>{formatVnd(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("savings")}</span>
                    <span>{formatVnd(savings)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("shipping")}</span>
                    <span>{t("calculatedNextStep")}</span>
                  </div>
                </div>

                <div className="flex items-end justify-between text-[#1A1A1A]">
                  <span className="text-base">{t("total")}</span>
                  <div className="text-right">
                    <span className="block text-2xl font-medium">{formatVnd(total)}</span>
                    <span className="text-xs text-[#666666]">{t("vatIncluded")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      {status !== "success" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E5E5] bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] sm:p-6 lg:p-4">
          <div className="mx-auto flex max-w-[1540px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="hidden lg:flex items-center gap-4 text-sm text-[#666666]">
            </div>

            <div className="flex items-center justify-between gap-6 lg:justify-end w-full lg:w-auto">
              <div className="flex flex-col">
                <span className="text-xs text-[#666666]">{t("total")}:</span>
                <span className="text-xl font-medium text-[#1A1A1A]">{formatVnd(total)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-[#666666]">{t("savings")}:</span>
                <span className="text-sm font-medium text-[#FF4D4F]">{formatVnd(savings)}</span>
              </div>
              <button
                type="submit"
                form="checkout-form"
                disabled={status === "submitting"}
                className="h-12 min-w-[160px] bg-[#1A1A1A] px-8 text-sm font-medium text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A] disabled:cursor-not-allowed disabled:bg-[#CCCCCC]"
              >
                {status === "submitting" ? t("submitting") : t("submit")}
              </button>
            </div>
          </div>
          {status === "error" && (
            <p className="mx-auto mt-2 max-w-[1540px] text-right text-xs text-[#FF4D4F]">{error}</p>
          )}
        </div>
      )}
    </main>
  );
}

function CheckoutItem({ item, selected, onToggle, onUpdateQuantity, disabled, isLast }: { item: CartItem, selected: boolean, onToggle: () => void, onUpdateQuantity: (id: string, q: number) => void, disabled: boolean, isLast: boolean }) {
  const t = useTranslations("Checkout");

  const currentPrice = parseCartPrice(item.price);
  const originalPrice = parseCartPrice(item.originalPrice || "");
  const hasValidDiscount = item.badgeTone === "sale" && item.discount && originalPrice > currentPrice;

  return (
    <div className={`flex gap-4 py-6 ${!isLast ? 'border-b border-[#E5E5E5]' : ''}`}>
      <div className="flex items-start pt-8">
        <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={disabled}
            className="peer h-4 w-4 appearance-none rounded-[2px] border border-[#CCCCCC] bg-white checked:border-[#1A1A1A] checked:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A] disabled:opacity-50 cursor-pointer"
          />
          <svg className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
      <div className="relative h-24 w-24 shrink-0 bg-white border border-[#E5E5E5] p-2">
         {hasValidDiscount && (
           <span className="absolute -left-2 -top-2 z-10 bg-[#FF4D4F] px-2 py-0.5 text-xs font-bold text-white shadow-sm">
             {item.discount}
           </span>
         )}
         <img src={item.image} alt={item.name} className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] object-contain" />
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex justify-between gap-4">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-[#1A1A1A] line-clamp-2">{item.name}</h3>
            <p className="mt-1 text-xs text-[#666666]">{item.category}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="block text-sm font-medium text-[#1A1A1A]">{formatVnd(currentPrice)}</span>
            {hasValidDiscount && <span className="text-xs text-[#999999] line-through">{item.originalPrice}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center border border-[#E5E5E5]">
            <button
              type="button"
              aria-label={t("decreaseQuantity")}
              disabled={disabled}
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              className="h-8 w-8 flex items-center justify-center text-[#1A1A1A] hover:bg-[#F4F4F4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <span className="flex h-8 w-10 items-center justify-center text-sm font-medium text-[#1A1A1A] border-x border-[#E5E5E5]">{item.quantity}</span>
            <button
              type="button"
              aria-label={t("increaseQuantity")}
              disabled={disabled}
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="h-8 w-8 flex items-center justify-center text-[#1A1A1A] hover:bg-[#F4F4F4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
