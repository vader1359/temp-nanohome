"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function Newsletter() {
  const t = useTranslations("Newsletter");

  return (
    <section
      className="relative flex min-h-[576px] w-full justify-center overflow-hidden bg-cover bg-center py-12 sm:py-16 lg:py-20"
      style={{ backgroundImage: "url(/images/newsletter_bg.png)" }}
    >
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

        <form className="flex w-full max-w-[480px] flex-col items-center gap-4">
          <label className="flex w-full flex-col gap-1 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("emailLabel")}
            <input
              type="email"
              aria-label={t("emailLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-1.5 text-white focus:border-white focus:outline-none"
            />
          </label>

          <label className="flex w-full flex-col gap-1 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("phoneLabel")}
            <input
              type="tel"
              aria-label={t("phoneLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-1.5 text-white focus:border-white focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className={cn(
              "w-fit rounded-none border border-white bg-white px-6 py-2 text-xs font-medium uppercase leading-4 tracking-wider text-[#111111]",
              "min-h-[36px] min-w-[112px] transition-colors hover:bg-[#111111] hover:text-white",
            )}
          >
            {t("cta")}
          </button>
        </form>
      </div>
    </section>
  );
}
