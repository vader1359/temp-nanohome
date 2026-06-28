import { useTranslations } from "next-intl";
import Image from "next/image";

export function About() {
  const t = useTranslations("About");
  return <section className="bg-[#faf9f8] px-6 py-[60px] lg:px-10">
    <div className="text-center"><p className="text-sm font-medium uppercase leading-5 text-[#444]">{t("eyebrow")}</p><h2 className="mt-4 text-[32px] font-medium leading-10">{t("heading")}</h2></div>
    <div className="relative mt-12 aspect-[1360/615] min-h-[360px] overflow-hidden"><Image src="/images/about_img.png" alt="" fill className="object-cover" sizes="calc(100vw - 80px)" /><div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-3">{[0,1,2,3,4].map((x)=><span key={x} className={`size-1.5 rounded-full ${x===2?"bg-white":"border border-white"}`} />)}</div></div>
    <div className="mx-auto mt-12 grid max-w-[1024px] gap-8 md:grid-cols-[369px_1fr] md:gap-10"><h3 className="text-2xl font-normal leading-8 text-[#444]">{t("leftHeading")}</h3><div className="border-l border-[#cfc9c0] pl-8 text-sm leading-[22px] text-[#444]"><p>{t("p1")}</p><p className="mt-4">{t("p2")}</p></div></div>
  </section>;
}
