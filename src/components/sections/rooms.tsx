"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Image from "next/image";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

const rooms = [
  { id: 1, image: "/images/room-living.png", glow: "rgba(103,70,20,.8)" },
  { id: 2, image: "/images/room-dining.png", glow: "rgba(103,20,20,.8)" },
  { id: 3, image: "/images/room-bedroom.png", glow: "rgba(20,103,31,.8)" },
  { id: 4, image: "/images/room-outdoor.png", glow: "rgba(20,88,103,.8)" },
] as const;

export function Rooms() {
  const t = useTranslations("Rooms");
  const [slideIdx, setSlideIdx] = useState(0);
  const [sliderLoaded, setSliderLoaded] = useState(false);

  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: false,
    slideChanged(s) {
      setSlideIdx(s.track.details.rel);
    },
    created() {
      setSliderLoaded(true);
    },
    slides: {
      perView: 1,
      spacing: 12,
    },
  });

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="site-shell">
        <div className="text-center">
          <p className="text-sm font-medium uppercase leading-5 text-[#444]">{t("eyebrow")}</p>
          <h2 className="mt-4 text-[32px] font-medium leading-10">{t("heading")}</h2>
        </div>

        {/* Mobile carousel — visible below md */}
        <div className="mt-[60px] block md:hidden">
          <div ref={sliderRef} className="keen-slider">
            {rooms.map(({ id, image, glow }) => (
              <div key={id} className="keen-slider__slide">
                <article className="relative aspect-[4/5] overflow-hidden">
                  <Image src={image} alt={t(`title${id}`)} fill sizes="100vw" className="object-cover" />
                  <div className="absolute left-1/2 top-1/2 h-[262px] w-[510px] -translate-x-1/2 -translate-y-1/2 blur-[56px]" style={{ background: glow }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
                    <p className="text-xs font-medium leading-4">{t(`sub${id}`)}</p>
                    <h3 className="mt-1 text-[32px] font-medium capitalize leading-10">{t(`title${id}`)}</h3>
                    <p className="mt-4 max-w-[390px] text-base leading-6 text-[#f1f1f1]">{t(`desc${id}`)}</p>
                    <button className="mt-6 h-[52px] border border-white bg-white px-8 text-sm font-medium uppercase text-[#111] transition-colors hover:bg-[#111] hover:text-white">{t("cta")}</button>
                  </div>
                </article>
              </div>
            ))}
          </div>
          {sliderLoaded && (
            <div className="mt-6 flex items-center justify-center gap-2">
              {rooms.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => slider.current?.moveToIdx(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`size-1.5 rounded-full transition-colors ${
                    slideIdx === idx ? "bg-[#111]" : "border border-[#111]/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop grid — visible at md and above */}
        <div className="mt-[60px] hidden gap-6 md:grid md:grid-cols-2">
          {rooms.map(({ id, image, glow }) => (
            <article key={id} className="relative aspect-[4/5] overflow-hidden">
              <Image src={image} alt={t(`title${id}`)} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              <div className="absolute left-1/2 top-1/2 h-[262px] w-[510px] -translate-x-1/2 -translate-y-1/2 blur-[56px]" style={{ background: glow }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
                <p className="text-xs font-medium leading-4">{t(`sub${id}`)}</p>
                <h3 className="mt-1 text-[32px] font-medium capitalize leading-10">{t(`title${id}`)}</h3>
                <p className="mt-4 max-w-[390px] text-base leading-6 text-[#f1f1f1]">{t(`desc${id}`)}</p>
                <button className="mt-6 h-[52px] border border-white bg-white px-8 text-sm font-medium uppercase text-[#111] transition-colors hover:bg-[#111] hover:text-white">{t("cta")}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
