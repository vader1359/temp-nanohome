"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Image as ImageIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.css";

import type { InstagramPost } from "@/lib/instagram-post";

type InstagramGalleryProps = {
  readonly posts: readonly InstagramPost[];
};

export function InstagramGallery({ posts }: InstagramGalleryProps) {
  const t = useTranslations("Instagram");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null ? (prev - 1 + posts.length) % posts.length : null));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % posts.length : null));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, posts.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [lightboxIndex]);

  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: true,
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
    created() {
      setLoaded(true);
    },
    slides: {
      perView: 1,
      spacing: 8,
    },
    breakpoints: {
      "(min-width: 640px)": {
        slides: { perView: 2.5, spacing: 12 },
      },
      "(min-width: 1280px)": {
        slides: { perView: 3.5, spacing: 16 },
      },
      "(min-width: 1440px)": {
        slides: { perView: 4.5, spacing: 16 },
      },
    },
  });

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const interval = window.setInterval(() => {
      slider.current?.next();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loaded, slider]);

  const maxIdx = slider?.current?.track?.details?.maxIdx ?? 0;
  const atStart = currentSlide === 0;
  const atEnd = currentSlide >= maxIdx;
  const lightboxPost = lightboxIndex === null ? null : posts[lightboxIndex] ?? null;

  return (
    <section className="flex h-auto flex-col items-center gap-12 bg-white py-12 sm:py-16 lg:py-20">
      <div className="flex w-full flex-col items-center gap-12">
      <div className="site-shell flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[#666666] leading-5">
          {t("eyebrow")}
        </p>
        <h2 className="text-[32px] font-medium leading-10 text-[#111111]">
          {t("heading")}
        </h2>
      </div>

      <div className="site-shell relative w-full !px-24 lg:!px-0">
        <div ref={sliderRef} className="keen-slider overflow-hidden">
          {posts.map((post, i) => (
            <div
              key={post.id}
              className="keen-slider__slide flex justify-center sm:px-1.5 lg:px-2"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open ${post.mediaType} post ${i + 1}`}
                className="group relative aspect-[4/5] w-full overflow-hidden bg-[#F5F5F5] text-left cursor-zoom-in"
              >
                {post.mediaType === "image" ? (
                  <Image
                    src={post.imageUrl}
                    alt={post.caption ?? `Instagram post ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 29vw, 67vw"
                    unoptimized
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <video
                    aria-hidden
                    autoPlay
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    data-testid="instagram-video-preview"
                    loop
                    muted
                    playsInline
                    poster={post.thumbnailUrl}
                    preload="metadata"
                    src={post.videoUrl}
                  />
                )}
                <span className="absolute left-3 top-3 z-10 text-white drop-shadow-md">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="absolute right-3 top-3 z-10 text-white drop-shadow-md">
                  <ImageIcon className="h-4 w-4" />
                </span>
              </button>
            </div>
          ))}
        </div>

        {loaded && slider.current && (
          <>
            <button
              onClick={() => slider.current?.prev()}
              disabled={atStart}
              aria-label="Previous"
              className={`absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#333] shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:flex sm:h-12 sm:w-12 ${
                atStart
                  ? "cursor-default opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => slider.current?.next()}
              disabled={atEnd}
              aria-label="Next"
              className={`absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#333] shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:flex sm:h-12 sm:w-12 ${
                atEnd
                  ? "cursor-default opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {loaded && posts.length > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2 sm:hidden">
            {posts.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => slider.current?.moveToIdx(idx)}
                aria-label={`Go to Instagram slide ${idx + 1}`}
                className={`size-1.5 shrink-0 rounded-full transition-colors ${
                  currentSlide === idx ? "bg-[#111]" : "border border-[#111]/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      </div>

      {lightboxPost !== null && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute right-6 top-6 text-white/80 hover:text-white transition-colors p-2 z-50 cursor-pointer"
            aria-label="Close lightbox"
          >
            <X className="h-8 w-8" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev !== null ? (prev - 1 + posts.length) % posts.length : null));
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors p-2 md:left-8 z-50 cursor-pointer"
            aria-label="Previous post"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>

          <div
            className="relative h-[80vh] w-[90vw] max-w-[600px] aspect-[4/5] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxPost.mediaType === "image" ? (
              <Image
                src={lightboxPost.imageUrl}
                alt={lightboxPost.caption ?? `Instagram post ${lightboxIndex + 1}`}
                fill
                className="object-contain"
                sizes="90vw"
                priority
              />
            ) : (
              <video
                autoPlay
                className="h-full w-full object-contain"
                controls
                data-testid="instagram-video-lightbox"
                loop
                muted
                playsInline
                poster={lightboxPost.thumbnailUrl}
                preload="metadata"
                src={lightboxPost.videoUrl}
              />
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev !== null ? (prev + 1) % posts.length : null));
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors p-2 md:right-8 z-50 cursor-pointer"
            aria-label="Next post"
          >
            <ChevronRight className="h-10 w-10" />
          </button>
        </div>
      )}
    </section>
  );
}
