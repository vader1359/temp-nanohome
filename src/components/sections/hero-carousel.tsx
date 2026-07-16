"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { HomepageCmsSection } from "@/lib/queries/homepage-cms";

export type HotspotProduct = { readonly image: string; readonly brand: string; readonly name: string; readonly price: string };
type Hotspot = { readonly position: string; readonly cardPlacement: "above-right" | "below" | "above-left"; readonly product: HotspotProduct };
const hotspotData: readonly Hotspot[] = [
  { position: "left-[19%] top-[58%]", cardPlacement: "above-right", product: { image: "/images/p_lc2.png", brand: "Cassina", name: "Fauteuil Grand Confort, petit modèle", price: "45.500.000 đ" } },
  { position: "left-[53%] top-[46%]", cardPlacement: "below", product: { image: "/images/p_febo.png", brand: "Maxalto", name: "Febo Chair", price: "10.000.000 đ" } },
  { position: "right-[18%] top-[61%]", cardPlacement: "above-left", product: { image: "/images/feat_egg_main.png", brand: "Fritz Hansen", name: "Egg Chair", price: "32.900.000 đ" } },
];
const cardPositionClasses: Record<Hotspot["cardPlacement"], string> = { "above-right": "bottom-full left-0 mb-3", below: "top-full left-1/2 -translate-x-1/2 mt-3", "above-left": "bottom-full right-0 mb-3" };
const heroImages = ["/images/home/hero/hero-1.webp", "/images/home/hero/hero-2.webp", "/images/home/hero/hero-3.webp"];
type StaticSlide = Readonly<{ readonly brand: string; readonly logoUrl: string; readonly link: string; readonly titleKey1: "slide0_titleLine1" | "slide1_titleLine1" | "slide2_titleLine1"; readonly titleKey2: "slide0_titleLine2" | "slide1_titleLine2" | "slide2_titleLine2" }>;
const staticSlides: readonly StaticSlide[] = [
  { brand: "Cassina", logoUrl: "https://res.cloudinary.com/nanohome-web/image/upload/website/auto/46/1760616000000/BYb8Z70enjeBnPAm8_EYVw/X5TiDEWs4RhsRqO95IYKfPS9miF3G4yK97ZfD73ec6TfwErMPvL1uTaNt5kdOGNEqo42x2cjUJneze7SzTxxFnE0PwfwO2_MQwzlABzERUZcQvxYg89GS3s0SVCxzLSD-mtoQoFtqzzUGSu1k6y41g/Tmq1AeOM8RE1GS2cTaeng_-HOWa5AKZYBwGOwputCpQ", link: "/products?brand=cassina", titleKey1: "slide0_titleLine1", titleKey2: "slide0_titleLine2" },
  { brand: "B&B Italia", logoUrl: "https://res.cloudinary.com/nanohome-web/image/upload/website/auto/52/1775455200000/ne3jm3UdZK00u8UhdNmxrg/zEZGc738wiffb-yOFd9cuXsih1lTMd-LHlLM7nbESvcXdB1Vo5leB7yxBBvX3X8rpTIwSqUurcNfel_UM8jxEPgCGZukVqRIrOqydFYfInsMSaTqponXxenGw8lW_Vm6qNyUXBFYsHUx46bF7N3Xvcg/l1kcfTLVCnEJO5XnjuKt0NmXBVTSRj4SVkvYLw2A7mg", link: "/products?brand=b-b-italia", titleKey1: "slide1_titleLine1", titleKey2: "slide1_titleLine2" },
  { brand: "Maxalto", logoUrl: "https://res.cloudinary.com/nanohome-web/image/upload/website/auto/52/1775455200000/1rDGe21New9SZk_rYBvq-Q/XLHr52wgGYVgPOij5XApYwGdUYTkilvUYfATLsTXrFM1m4LXVJIK-HNuD1mKyQGg9Q3nos_kFnorg-Z9pl4kkCLQnKkcZ_VQpf0oyOA4vudjEBOKVurc05U-HhQJw8zY7sCGUpB2jE8Lw2A05ejZ-g/p6-kNaMiSjgcwXRX5yJex9l4k26rnm0XrHLtR4DuK38", link: "/products?brand=maxalto", titleKey1: "slide2_titleLine1", titleKey2: "slide2_titleLine2" },
];

type CarouselProps = Readonly<{ readonly products: readonly HotspotProduct[]; readonly cmsHero?: Extract<HomepageCmsSection, { readonly type: "hero" }> }>;
type Slide = Readonly<{ readonly image: string; readonly mobileImage?: string; readonly alt: string; readonly brand: string; readonly logoUrl?: string; readonly title?: string; readonly body?: string; readonly link?: string; readonly ctaLabel?: string | null }>;

function cmsSlides(cmsHero: CarouselProps["cmsHero"]): readonly Slide[] {
  if (cmsHero === undefined || cmsHero.slides.length === 0) return [];
  return cmsHero.slides.map((slide) => ({ image: slide.media.delivery_url, mobileImage: slide.mobileMedia?.delivery_url, alt: slide.media.alt, brand: slide.eyebrow ?? "", title: slide.title, body: slide.body ?? undefined, link: slide.cta_href?.startsWith("/") && !slide.cta_href.startsWith("//") ? slide.cta_href : undefined, ctaLabel: slide.ctaLabel }));
}

export function HeroCarousel({ products, cmsHero }: CarouselProps) {
  const t = useTranslations("Hero");
  const cms = cmsSlides(cmsHero);
  const isCms = cms.length > 0;
  const slides: readonly Slide[] = isCms ? cms : heroImages.map((image, index) => ({ image, alt: "", brand: staticSlides[index]?.brand ?? "", logoUrl: staticSlides[index]?.logoUrl, title: t(staticSlides[index]?.titleKey1 ?? ""), body: t(staticSlides[index]?.titleKey2 ?? ""), link: staticSlides[index]?.link }));
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [openCard, setOpenCard] = useState<number | null>(null);
  const hotspotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const changeSlide = useCallback((newIndex: number) => { if (newIndex === activeIndex || fadeState === "out") return; setNextIndex(newIndex); setFadeState("out"); }, [activeIndex, fadeState]);
  useEffect(() => { if (fadeState !== "out" || nextIndex === null) return; const timer = setTimeout(() => { setActiveIndex(nextIndex); setNextIndex(null); setFadeState("in"); }, 300); return () => clearTimeout(timer); }, [fadeState, nextIndex]);
  const handleHotspotClick = useCallback((index: number) => setOpenCard((prev) => (prev === index ? null : index)), []);
  useEffect(() => { if (openCard === null) return; const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenCard(null); }; document.addEventListener("keydown", handleKeyDown); return () => document.removeEventListener("keydown", handleKeyDown); }, [openCard]);
  useEffect(() => { if (openCard === null) return; const handlePointerDown = (event: MouseEvent) => { const target = event.target; if (!(target instanceof Node) || !hotspotRefs.current[openCard]?.contains(target)) setOpenCard(null); }; document.addEventListener("mousedown", handlePointerDown); return () => document.removeEventListener("mousedown", handlePointerDown); }, [openCard]);
  const current = slides[activeIndex];
  if (current === undefined) return null;
  const previous = () => changeSlide(activeIndex === 0 ? slides.length - 1 : activeIndex - 1);
  const next = () => changeSlide(activeIndex === slides.length - 1 ? 0 : activeIndex + 1);
  return <section className="relative min-h-[280px] aspect-[3/2] w-full overflow-hidden lg:aspect-auto lg:h-[840px] xl:h-[900px]">
    <Image src={current.image} alt={current.alt} aria-hidden={current.alt === ""} fill preload={activeIndex === 0} sizes="100vw" style={{ opacity: fadeState === "in" ? 1 : 0 }} className="object-cover object-center transition-opacity duration-300 ease-in-out motion-reduce:transition-none" />
    {current.mobileImage && <Image src={current.mobileImage} alt="" aria-hidden fill sizes="100vw" className="hidden" />}
    <div className="absolute inset-0 bg-linear-to-r from-black/55 via-black/25 to-black/20" /><div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/35" />
    {current.logoUrl && <div style={{ opacity: fadeState === "in" ? 1 : 0 }} className="site-shell absolute inset-x-0 bottom-[250px] z-20 sm:bottom-[310px] lg:bottom-[340px] transition-opacity duration-300 ease-in-out motion-reduce:transition-none"><Image src={current.logoUrl} alt={current.brand} width={148} height={48} className="h-auto w-[110px] object-contain sm:w-[130px] lg:w-[156px] brightness-0 invert" /></div>}
    <div style={{ opacity: fadeState === "in" ? 1 : 0 }} className="absolute inset-x-0 bottom-16 z-10 lg:bottom-20 transition-opacity duration-300 ease-in-out motion-reduce:transition-none"><div className="site-shell"><h1 className="break-words text-3xl font-normal leading-9 text-white sm:text-4xl sm:leading-10 lg:text-[48px] lg:leading-[56px]"><span className="block">{current.title}</span>{current.body && <span className="block">{current.body}</span>}</h1>{current.link && (!isCms || current.ctaLabel?.trim()) && <Link href={current.link} className="mt-8 inline-block rounded-none border border-white bg-white px-5 py-2.5 text-xs font-medium uppercase leading-4 tracking-wider text-[#111111] transition-colors hover:bg-[#111111] hover:text-white">{isCms ? current.ctaLabel?.trim() : t("cta")}</Link>}</div></div>
    {!isCms && hotspotData.map((hotspot, index) => { const product = products[index] ?? hotspot.product; const isOpen = openCard === index; return <div key={hotspot.position} ref={(element) => { hotspotRefs.current[index] = element; }} className={cn("absolute z-30 hidden", hotspot.position)}><button type="button" onClick={() => handleHotspotClick(index)} aria-expanded={isOpen} aria-label="Xem sản phẩm nổi bật" className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.55)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-white/25" /><span aria-hidden className="relative h-4 w-4 rounded-full bg-white" /></button>{isOpen && <div className={cn("absolute w-[220px] max-w-[calc(100vw-2rem)]", cardPositionClasses[hotspot.cardPlacement])}><div className="overflow-hidden rounded-lg bg-white p-2.5 shadow-xl ring-1 ring-black/5"><button type="button" onClick={() => setOpenCard(null)} aria-label="Đóng" className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#666] shadow-sm backdrop-blur-md transition-colors hover:bg-gray-100 hover:text-[#111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"><X className="h-3.5 w-3.5" /></button><div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-[#FAFAFA]"><Image src={product.image} alt={product.name} fill className="object-contain p-2" sizes="200px" /></div><div className="px-1 pb-1 pt-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-nh-muted">{product.brand}</p><h3 className="mt-0.5 truncate text-xs font-medium text-[#222]">{product.name}</h3><p className="mt-1.5 text-xs font-semibold text-nh-ink">{product.price}</p></div></div></div>}</div>; })}
    <button type="button" onClick={previous} aria-label="Previous slide" className="absolute left-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] sm:left-4 sm:flex lg:left-8"><ChevronLeft className="size-4" /></button><button type="button" onClick={next} aria-label="Next slide" className="absolute right-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] sm:right-4 sm:flex lg:right-8"><ChevronRight className="size-4" /></button>
    <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5">{slides.map((_, index) => <button key={index} type="button" onClick={() => changeSlide(index)} aria-label={`Go to slide ${index + 1}`} className={cn("h-0.5 transition-all", activeIndex === index ? "w-10 bg-white" : "w-6 bg-white/20")} />)}</div><div className="absolute bottom-10 right-6 z-20 text-lg font-medium leading-none text-white lg:right-12">↓</div>
  </section>;
}
