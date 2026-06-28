"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Newsletter() {
  const t = useTranslations("Newsletter");

  return (
    <section
      className="relative flex h-[576px] w-full justify-center overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url(/images/newsletter_bg.png)" }}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex w-full flex-col items-center justify-center gap-10 px-6 text-center">
        <div className="flex flex-col items-center gap-[35px]">
          <h2 className="text-[46px] font-medium leading-[56px] text-white">
            {t("title")}
          </h2>
          <p className="max-w-[720px] text-[14px] font-medium uppercase leading-5 text-white">
            {t("subtitle")}
          </p>
        </div>

        <form className="flex w-full max-w-[480px] flex-col gap-4">
          <label className="flex flex-col gap-2 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("emailLabel")}
            <input
              type="email"
              aria-label={t("emailLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-3 text-white focus:border-white focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("phoneLabel")}
            <input
              type="tel"
              aria-label={t("phoneLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-3 text-white focus:border-white focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className={cn(
              "rounded-none border border-white bg-[#111111] px-8 py-4 text-sm font-medium uppercase leading-5 tracking-wider text-white",
              "min-h-[52px] min-w-[127px] transition-colors hover:bg-white hover:text-[#111111]",
            )}
          >
            {t("cta")}
          </button>
        </form>
      </div>
    </section>
  );
}
