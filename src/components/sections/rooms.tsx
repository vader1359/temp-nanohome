import { useTranslations } from "next-intl";
import Image from "next/image";

const rooms = [
  { id: 1, image: "/images/room-living.png", glow: "rgba(103,70,20,.8)" },
  { id: 2, image: "/images/room-dining.png", glow: "rgba(103,20,20,.8)" },
  { id: 3, image: "/images/room-bedroom.png", glow: "rgba(20,103,31,.8)" },
  { id: 4, image: "/images/room-outdoor.png", glow: "rgba(20,88,103,.8)" },
] as const;

export function Rooms() {
  const t = useTranslations("Rooms");
  return <section className="px-6 py-[60px] lg:px-12"><div className="text-center"><p className="text-sm font-medium uppercase leading-5 text-[#444]">{t("eyebrow")}</p><h2 className="mt-4 text-[32px] font-medium leading-10">{t("heading")}</h2></div>
    <div className="mt-[60px] grid gap-6 md:grid-cols-2">{rooms.map(({id,image,glow})=><article key={id} className="relative h-[420px] overflow-hidden sm:h-[560px] lg:h-[760px]"><Image src={image} alt={t(`title${id}`)} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /><div className="absolute left-1/2 top-1/2 h-[262px] w-[510px] -translate-x-1/2 -translate-y-1/2 blur-[56px]" style={{background:glow}} /><div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white"><p className="text-xs font-medium leading-4">{t(`sub${id}`)}</p><h3 className="mt-1 text-[32px] font-medium capitalize leading-10">{t(`title${id}`)}</h3><p className="mt-4 max-w-[390px] text-base leading-6 text-[#f1f1f1]">{t(`desc${id}`)}</p><button className="mt-6 h-[52px] border border-white bg-[#111] px-8 text-sm font-medium uppercase">{t("cta")}</button></div></article>)}</div>
  </section>;
}
