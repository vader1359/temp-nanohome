"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
} from "lucide-react";
import { Breadcrumb, ColorSelector } from "@/components/product-detail";
import { DarkCTAButton, FavoriteButton, IconTextRow } from "@/components/shared";
import { product as fallbackProduct, breadcrumbs } from "@/components/product-detail/mock-data";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/lib/utils";

interface Section1HeroProps {
  product?: typeof fallbackProduct & {
    brandLogoUrl?: string | null;
    id?: string;
    sku?: string;
  };
}

export function Section1Hero({ product = fallbackProduct }: Section1HeroProps) {
  const t = useTranslations("ProductDetail");
  const [activeThumb, setActiveThumb] = useState(0);
  const productImageRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCart();

  const playAddToCartAnimation = () => {
    const imageBox = productImageRef.current;
    const cartTarget = document.querySelector<HTMLElement>("[data-cart-target]");
    if (!imageBox || !cartTarget) return;

    const imageRect = imageBox.getBoundingClientRect();
    const targetRect = cartTarget.getBoundingClientRect();
    const image = document.createElement("img");
    image.src = product.gallery[activeThumb] ?? product.gallery[0] ?? "/images/p_lc2.png";
    image.alt = "";
    image.className = "pointer-events-none fixed z-[9999] rounded-sm object-contain shadow-2xl";
    image.style.left = `${imageRect.left}px`;
    image.style.top = `${imageRect.top}px`;
    image.style.width = `${imageRect.width}px`;
    image.style.height = `${imageRect.height}px`;
    image.style.transformOrigin = "center center";
    image.style.willChange = "transform, opacity, border-radius";
    document.body.appendChild(image);

    const deltaX = targetRect.left + targetRect.width / 2 - (imageRect.left + imageRect.width / 2);
    const deltaY = targetRect.top + targetRect.height / 2 - (imageRect.top + imageRect.height / 2);

    const animation = image.animate(
      [
        { borderRadius: "2px", opacity: 0.95, transform: "translate3d(0, 0, 0) scale(1) skew(0deg, 0deg)" },
        { borderRadius: "18px", opacity: 0.75, transform: `translate3d(${deltaX * 0.42}px, ${deltaY * 0.35}px, 0) scale(0.58, 0.82) skew(-10deg, 4deg)` },
        { borderRadius: "999px", opacity: 0, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.08, 0.18) skew(-18deg, 8deg)` },
      ],
      { duration: 760, easing: "cubic-bezier(0.2, 0.9, 0.18, 1)", fill: "forwards" },
    );
    animation.addEventListener("finish", () => image.remove(), { once: true });
    animation.addEventListener("cancel", () => image.remove(), { once: true });
  };

  const handleAddToCart = () => {
    playAddToCartAnimation();
    addItem({
      id: product.id ?? product.sku ?? product.title,
      name: product.title,
      category: product.category,
      price: product.newPrice,
      originalPrice: product.oldPrice || undefined,
      discount: product.discount || undefined,
      badge: product.onSale ? "SALE" : t("inStockBadge"),
      badgeTone: product.onSale ? "sale" : "stock",
      image: product.gallery[0] ?? "/images/p_lc2.png",
    });
  };

  return (
    <section className="flex flex-col overflow-x-hidden bg-white">
      {/* Breadcrumb */}
      <div className="site-shell pb-10 pt-6">
        <Breadcrumb items={breadcrumbs} current={product.breadcrumbTitle} />
      </div>

      {/* Content row — gallery left, purchase panel right */}
      <div className="mx-auto flex w-full max-w-[1024px] flex-col items-center gap-10 overflow-hidden pb-16 lg:flex-row lg:items-start lg:gap-12 px-4">
        {/* ─── Gallery ─── */}
        <div className="flex min-w-0 w-full flex-col gap-0 lg:basis-1/2 lg:px-0">
          {/* Main image */}
          <div ref={productImageRef} className="relative aspect-[1/1] w-full overflow-hidden bg-white">
            <Image
              src={product.gallery[activeThumb]}
              alt={product.title}
              fill
              sizes="(max-width:768px) 100vw, 520px"
              className="object-contain px-12 py-2 sm:px-16 sm:py-3 lg:px-20 lg:py-4"
              priority
            />
          </div>

          {/* Horizontal thumbnail strip */}
          <div className="mt-10 flex w-full min-w-0 items-center justify-center gap-1 overflow-x-auto bg-white px-2 pb-1 text-center [scrollbar-width:none]">
            {product.gallery.slice(0, 5).map((src, i) => {
              const active = activeThumb === i;
              const hasMoreImages = product.gallery.length > 5;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveThumb(i)}
                  className={`relative aspect-square w-16 min-w-0 shrink-0 overflow-hidden transition-opacity md:w-20 ${
                    active ? "opacity-100" : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <Image
                    src={src}
                    alt={t("thumbnailAlt", { index: i + 1 })}
                    fill
                    sizes="80px"
                    className="max-w-full object-cover"
                  />
                  {i === 4 && !active && hasMoreImages && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[18px] font-medium leading-[26px] text-white">
                      +{product.gallery.length - 5}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Purchase Panel ─── */}
        <div className="flex min-w-0 w-full flex-col gap-9 lg:basis-1/2 lg:pl-8">
          {/* Product Summary */}
          <div className="flex flex-col gap-4">
            {/* Brand logo */}
            {(() => {
              const isUsm = product.brand.toLowerCase() === "usm";
              const logoUrl = isUsm ? "/images/usm_logo.png" : (product.brandLogoUrl ?? "/images/nanohome-logo.svg");
              return (
                <Image
                  src={logoUrl}
                  alt={product.brand}
                  width={120}
                  height={24}
                  className="h-[24px] w-auto self-start object-contain object-left"
                />
              );
            })()}

            {/* Title */}
            <h1 className="break-words text-[20px] font-medium leading-[28px] text-[#444] [overflow-wrap:break-word] sm:text-[24px] sm:leading-[32px]">
              {product.title}
            </h1>

            {/* Category */}
            <p className="text-[12px] leading-[18px] text-[#8A8178]">
              {product.category}
            </p>

            {/* SALE badge */}

            {/* Price */}
            <div className="flex flex-col items-start gap-1">
              <span className="text-[15px] font-semibold leading-[20px] text-[#111]">
                {product.oldPrice || product.newPrice}
              </span>
            </div>

            {/* Color Selector */}
            <ColorSelector />
          </div>

          {/* CTA row */}
          <div className="flex gap-4">
            <DarkCTAButton type="button" onClick={handleAddToCart} variant="solid" className="grow gap-2 leading-[20px] h-12 md:h-14 py-0 text-sm md:text-base">
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
              {t("addToCart")}
            </DarkCTAButton>
            <FavoriteButton variant="bordered" className="h-12 w-12 md:h-14 md:w-14 flex-none border-[#CFC9C0] bg-transparent" />
          </div>

          {/* Size info box */}
          <div className="flex flex-col gap-1 border border-[#CFC9C0] px-6 py-3">
            <span className="text-[14px] font-medium uppercase leading-[20px] text-[#111]">
              {t("sizeDetails")}
            </span>
            <span className="whitespace-pre-line text-[14px] leading-[22px] text-[#111]">
              {t("sizeFallback")}
            </span>
          </div>

          {/* Contact Service List */}
          <div className="flex flex-col gap-2">
            <IconTextRow
              iconVariant="inline"
              icon={<Calendar className="h-4 w-4" strokeWidth={1.5} />}
              value={t("appointment")}
              href="#"
            />
            <IconTextRow
              iconVariant="inline"
              icon={<MessageCircle className="h-4 w-4" strokeWidth={1.5} />}
              label={t("contact")}
              value={t("consultation")}
            />
            <IconTextRow
              iconVariant="inline"
              icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
              label={t("phoneOrder")}
              value="(+84) 33 948 7632"
              href="tel:+84339487632"
            />
            <IconTextRow
              iconVariant="inline"
              icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}
              label={t("availableAt")}
              value="Cassina Store"
              href="#"
            />
            <span className="pl-[28px] text-sm text-nh-accent -mt-1">nanoHome Gallery Saigon</span>
          </div>
        </div>
      </div>
    </section>
  );
}
