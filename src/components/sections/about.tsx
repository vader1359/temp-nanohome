import { useTranslations } from "next-intl";
import Image from "next/image";

import { PaginationDots, SectionHeading } from "@/components/shared";

export function About() {
  const t = useTranslations("About");
  return <section className="bg-[#faf9f8] px-6 py-[60px] lg:px-10">
    <SectionHeading eyebrow={t("eyebrow")} title={t("heading")} />
    <div className="relative mt-12 aspect-[1360/615] min-h-[360px] overflow-hidden"><Image src="/images/about_img.png" alt="" fill className="object-cover" sizes="calc(100vw - 80px)" /><PaginationDots count={5} activeIndex={2} className="absolute bottom-5 left-1/2 -translate-x-1/2" /></div>
    <div className="mx-auto mt-12 grid max-w-[1024px] gap-8 md:grid-cols-[369px_1fr] md:gap-10"><h3 className="text-2xl font-normal leading-8 text-[#444]">{t("leftHeading")}</h3><div className="border-l border-[#cfc9c0] pl-8 text-sm leading-[22px] text-[#444]"><p>{t("p1")}</p><p className="mt-4">{t("p2")}</p></div></div>
  </section>;
}
