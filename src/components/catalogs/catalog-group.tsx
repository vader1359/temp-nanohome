"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { useState } from "react";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

import { PdfThumbnail } from "./pdf-thumbnail";

export type CatalogCardItem = {
  readonly id: string;
  readonly origin: string;
  readonly title: string;
  readonly url: string;
};

type CatalogGroupProps = {
  readonly brandName: string;
  readonly cards: readonly CatalogCardItem[];
  readonly logoUrl: string | null;
  readonly downloadLabel: string;
};

function CatalogCard({ card, downloadLabel }: Readonly<{ card: CatalogCardItem; downloadLabel: string }>) {
  return (
    <article className="group min-w-0">
      <a href={card.url} target="_blank" rel="noreferrer" aria-label={card.title} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
        <PdfThumbnail title={card.title} url={card.url} />
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[12px] leading-[18px] text-nh-muted">{card.origin}</p>
          <h3 className="text-[18px] font-medium leading-7 text-nh-ink">{card.title}</h3>
          <span className="inline-flex items-center gap-2 text-[14px] font-medium leading-[22px] text-nh-accent transition-colors duration-300 ease-in-out group-hover:text-nh-ink">
            {downloadLabel}
            <Download className="size-4" aria-hidden="true" />
          </span>
        </div>
      </a>
    </article>
  );
}

function BrandHeading({ brandName, logoUrl }: Readonly<{ brandName: string; logoUrl: string | null }>) {
  return (
    <h2 id={`catalog-brand-${brandName}`} className="flex h-12 items-center">
      {logoUrl ? <Image src={logoUrl} alt={brandName} width={160} height={48} className="h-10 w-auto max-w-[180px] object-contain grayscale contrast-200 brightness-0" /> : <span className="text-[20px] font-medium leading-7 text-nh-ink">{brandName}</span>}
    </h2>
  );
}

export function CatalogGroup({ brandName, cards, logoUrl, downloadLabel }: Readonly<CatalogGroupProps>) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSliderReady, setIsSliderReady] = useState(false);
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: false,
    created() {
      setIsSliderReady(true);
    },
    slideChanged(instance) {
      setActiveSlide(instance.track.details.rel);
    },
    slides: { perView: 1.18, spacing: 16 },
    breakpoints: {
      "(min-width: 640px)": { slides: { perView: 2.2, spacing: 24 } },
      "(min-width: 1024px)": { slides: { perView: 3.2, spacing: 24 } },
    },
  });

  return (
    <section className="flex flex-col gap-8" aria-labelledby={`catalog-brand-${brandName}`}>
      <BrandHeading brandName={brandName} logoUrl={logoUrl} />
      <div className="xl:hidden">
        <div ref={sliderRef} className="keen-slider">
          {cards.map((card) => <div key={card.id} className="keen-slider__slide"><CatalogCard card={card} downloadLabel={downloadLabel} /></div>)}
        </div>
        {isSliderReady && cards.length > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-2" aria-label={`${brandName} catalog navigation`}>
            {cards.map((card, index) => <button key={card.id} type="button" onClick={() => slider.current?.moveToIdx(index)} aria-label={`Go to catalog ${index + 1}`} aria-current={activeSlide === index ? "true" : undefined} className={`size-1.5 rounded-full transition-colors duration-300 ${activeSlide === index ? "bg-nh-ink" : "bg-nh-border"}`} />)}
          </div>
        ) : null}
      </div>
      <div className="hidden xl:grid xl:grid-cols-6 xl:gap-6">
        {cards.map((card) => <CatalogCard key={card.id} card={card} downloadLabel={downloadLabel} />)}
      </div>
    </section>
  );
}
