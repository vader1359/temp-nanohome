"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCart, type CartItem } from "@/components/cart/cart-context";

export function Newsletter() {
  const t = useTranslations("Newsletter");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  let cartItems: CartItem[] = [];
  try {
    const cart = useCart();
    cartItems = cart.items;
  } catch {
    // Ignore error if CartProvider is not present (e.g. in some unit tests)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;

    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Email không hợp lệ.");
      setStatus("error");
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || !/^[0-9+\-\s()]{9,15}$/.test(trimmedPhone)) {
      setErrorMessage("Số điện thoại không hợp lệ (từ 9 đến 15 chữ số).");
      setStatus("error");
      return;
    }

    setStatus("submitting");

    const parseCartPrice = (price: string): number => {
      const numeric = Number(price.replace(/[^\d]/g, ""));
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const total = cartItems.reduce(
      (sum, item) => sum + parseCartPrice(item.price) * item.quantity,
      0,
    );

    try {
      const payload = {
        cartItems: cartItems.length > 0
          ? cartItems.map((item) => ({
              ...item,
              lineTotal: parseCartPrice(item.price) * item.quantity,
            }))
          : undefined,
        email: trimmedEmail,
        name: "Khách hàng",
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        phone: trimmedPhone,
        source: "nanohome-home",
        total: cartItems.length > 0 ? total : undefined,
      };

      const response = await fetch("/api/cart/submit", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data: unknown = await response.json();

      const isSuccessfulResponse = (value: unknown): value is { ok: true } => {
        return typeof value === "object" && value !== null && "ok" in value && value.ok === true;
      };

      if (!response.ok || !isSuccessfulResponse(data)) {
        throw new Error("Không thể gửi thông tin. Vui lòng thử lại.");
      }

      setStatus("success");
      setEmail("");
      setPhone("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi. Vui lòng thử lại.");
      setStatus("error");
    }
  };

  return (
    <section className="relative flex min-h-[576px] w-full justify-center overflow-hidden py-12 sm:py-16 lg:py-20">
      <Image
        src="/images/newsletter_bg.webp"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="site-shell relative z-10 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex flex-col items-center gap-[35px]">
          <h2 className="text-3xl font-medium leading-9 sm:text-4xl sm:leading-10 lg:text-[46px] lg:leading-[56px] text-white">
            {t("title")}
          </h2>
          <p className="max-w-[720px] text-[14px] font-medium uppercase leading-5 text-white">
            {t("subtitle")}
          </p>
        </div>

        {status === "success" ? (
          <div className="mt-4 flex w-full max-w-[480px] flex-col items-center gap-4 text-white" aria-live="polite">
            <p className="text-lg font-medium">Đăng ký thành công!</p>
            <p className="text-sm">nanoHome đã nhận thông tin và sẽ liên hệ quý khách sớm nhất.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full max-w-[480px] flex-col items-center gap-4">
            <label className="flex w-full flex-col gap-1 text-left text-[14px] font-medium uppercase leading-5 text-white">
              <span>{t("emailLabel")} <span className="text-red-400" aria-hidden="true">*</span></span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
                aria-label={t("emailLabel")}
                className="border-b border-[#CFC9C0] bg-transparent py-1.5 text-white focus:border-white focus:outline-none disabled:opacity-50"
              />
            </label>

            <label className="flex w-full flex-col gap-1 text-left text-[14px] font-medium uppercase leading-5 text-white">
              <span>{t("phoneLabel")} <span className="text-red-400" aria-hidden="true">*</span></span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={status === "submitting"}
                aria-label={t("phoneLabel")}
                className="border-b border-[#CFC9C0] bg-transparent py-1.5 text-white focus:border-white focus:outline-none disabled:opacity-50"
              />
            </label>

            {status === "error" && (
              <p className="text-sm text-red-400 font-medium text-left w-full mt-1" aria-live="assertive">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className={cn(
                "w-fit rounded-none border border-white bg-white px-6 py-2 text-xs font-medium uppercase leading-4 tracking-wider text-[#111111]",
                "min-h-[36px] min-w-[112px] transition-colors hover:bg-[#111111] hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {status === "submitting" ? "Đang gửi..." : t("cta")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
