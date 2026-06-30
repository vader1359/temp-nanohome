import { useTranslations } from "next-intl";
import Image from "next/image";

export function About() {
  const t = useTranslations("About");
  return <section className="bg-[#faf9f8] py-12 sm:py-16 lg:py-20">
    <div className="site-shell">
    <div className="text-center"><p className="text-sm font-medium uppercase leading-5 text-[#444]">{t("eyebrow")}</p><h2 className="mt-4 text-[32px] font-medium leading-10">{t("heading")}</h2></div>
    <div className="mx-auto mt-12 aspect-[1360/615] min-h-[360px] w-full"><div className="relative h-full overflow-hidden"><Image src="/images/space.jpg" alt="" fill className="object-cover" sizes="(min-width: 640px) calc(100vw - 80px), calc(100vw - 32px)" /><div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-3">{[0,1,2,3,4].map((x)=><span key={x} className={`size-1.5 rounded-full ${x===2?"bg-white":"border border-white"}`} />)}</div></div></div>
    <div className="mx-auto mt-12 grid max-w-[1024px] gap-8 md:grid-cols-[369px_1fr] md:items-center md:gap-10"><h3 className="text-2xl font-semibold leading-8 text-[#444]">{t("leftHeading")}</h3><div className="border-t border-[#cfc9c0] pt-8 text-sm font-medium leading-[22px] text-[#444] md:border-l md:border-t-0 md:pl-8 md:pt-0"><p>{t("p1")}</p><p className="mt-4">{t("p2")}</p></div></div>
    </div>
  </section>;
}
