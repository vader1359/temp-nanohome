"use client";

import { useRef, useState, useEffect } from "react";
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
import { useWishlist, type WishlistItem } from "@/components/wishlist/wishlist-context";

interface Section1HeroProps {
  product?: typeof fallbackProduct & {
    brandLogoUrl?: string | null;
    id?: string;
    size?: string | null;
    sku?: string;
  };
}

function getVisibleCartTarget(): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  return targets.find((target) => {
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null;
}

function getVisibleWishlistTarget(): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-wishlist-target]"));
  return targets.find((target) => {
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null;
}

export function Section1Hero({ product = fallbackProduct }: Section1HeroProps) {
  const t = useTranslations("ProductDetail");
  const [activeThumb, setActiveThumb] = useState(0);
  const productImageRef = useRef<HTMLDivElement>(null);
  const purchasePanelRef = useRef<HTMLDivElement>(null);
  const cartAnimationRef = useRef<(() => void) | null>(null);
  const wishlistAnimationRef = useRef<(() => void) | null>(null);
  const { addItem } = useCart();
  const { hasItem, toggleItem } = useWishlist();

  useEffect(() => {
    return () => {
      if (cartAnimationRef.current) cartAnimationRef.current();
      if (wishlistAnimationRef.current) wishlistAnimationRef.current();
    };
  }, []);

  const playFlightAnimation = (target: HTMLElement, onAnimationRefCleanup: () => void) => {
    const productImage = productImageRef.current;
    if (!productImage || !target) return null;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return null;
    }

    const imageRect = productImage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = `${imageRect.left}px`;
    wrapper.style.top = `${imageRect.top}px`;
    wrapper.style.width = `${imageRect.width}px`;
    wrapper.style.height = `${imageRect.height}px`;
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "9999";

    wrapper.setAttribute("aria-hidden", "true");
    wrapper.setAttribute("inert", "");
    if ("inert" in wrapper) {
      (wrapper as unknown as { inert: boolean }).inert = true;
    }

    const clone = productImage.cloneNode(true) as HTMLElement;
    if (clone.id) {
      clone.removeAttribute("id");
    }
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));

    clone.setAttribute("tabindex", "-1");
    if ("tabIndex" in clone) {
      clone.tabIndex = -1;
    }
    clone.querySelectorAll("*").forEach((el) => {
      el.setAttribute("tabindex", "-1");
      if ("tabIndex" in el) {
        (el as unknown as { tabIndex: number }).tabIndex = -1;
      }
    });

    clone.style.backgroundColor = "white";
    clone.style.overflow = "hidden";
    clone.style.boxShadow = "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
    clone.style.transformOrigin = "center center";
    clone.style.pointerEvents = "none";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.margin = "0";
    clone.style.padding = "72px";
    clone.style.border = "1px solid #e2e8f0";
    clone.style.willChange = "transform, opacity";

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    let flightWrapperAnim: Animation | null = null;
    let flightInnerAnim: Animation | null = null;
    let targetAnim: Animation | null = null;

    // Initial focus pop
    const focusAnim = clone.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.05)", offset: 0.5 },
        { transform: "scale(1.02)" }
      ],
      { duration: 350, easing: "cubic-bezier(0.2, 0, 0.4, 1)", fill: "forwards" }
    );

    let isCleanedUp = false;

    const cancelAll = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      wrapper.remove();
      focusAnim.cancel();
      if (flightWrapperAnim) flightWrapperAnim.cancel();
      if (flightInnerAnim) flightInnerAnim.cancel();
      if (targetAnim) targetAnim.cancel();
    };

    focusAnim.onfinish = () => {
      if (isCleanedUp) return;
      const flightDuration = 760;
      const deltaX = targetRect.left + targetRect.width / 2 - (imageRect.left + imageRect.width / 2);
      const deltaY = targetRect.top + targetRect.height / 2 - (imageRect.top + imageRect.height / 2);

      // Wrapper handles horizontal flight (linear-ish for curve effect)
      flightWrapperAnim = wrapper.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(${deltaX}px, 0, 0)` }
        ],
        { duration: flightDuration, easing: "cubic-bezier(0.25, 1, 0.5, 1)", fill: "forwards" }
      );

      // Clone handles vertical drop, scale, rotate, opacity
      flightInnerAnim = clone.animate(
        [
          { opacity: 0.95, transform: "translate3d(0, 0, 0) scale(1.02) rotate(0deg)" },
          {
            opacity: 0.85,
            transform: `translate3d(0, ${deltaY * 0.4}px, 0) scale(0.3) rotate(${deltaX > 0 ? 12 : -12}deg)`,
            offset: 0.5
          },
          { opacity: 0, transform: `translate3d(0, ${deltaY}px, 0) scale(0.05) rotate(0deg)` },
        ],
        { duration: flightDuration, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" },
      );

      flightInnerAnim.onfinish = () => {
        if (isCleanedUp) return;
        cleanup();
      };

      function cleanup() {
        wrapper.remove();
        if (target) {
          targetAnim = target.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.25) rotate(-5deg)", offset: 0.4 },
              { transform: "scale(0.9) rotate(3deg)", offset: 0.7 },
              { transform: "scale(1) rotate(0deg)" }
            ],
            { duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
          );

          targetAnim.onfinish = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            onAnimationRefCleanup();
          };
        } else {
          isCleanedUp = true;
          onAnimationRefCleanup();
        }
      }
    };

    return cancelAll;
  };

  const handleAddToCart = () => {
    if (cartAnimationRef.current) {
      cartAnimationRef.current();
      cartAnimationRef.current = null;
    }
    const cartTarget = getVisibleCartTarget();
    if (cartTarget) {
      cartAnimationRef.current = playFlightAnimation(cartTarget, () => {
        if (cartAnimationRef.current) {
          cartAnimationRef.current = null;
        }
      });
    }
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
                  aria-pressed={active}
                  aria-label={t("thumbnailAlt", { index: i + 1 })}
                  onClick={() => setActiveThumb(i)}
                  className={`relative aspect-square w-16 min-w-0 shrink-0 overflow-hidden transition-opacity md:w-20 ${
                    active ? "opacity-100" : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <Image
                    src={src}
                    alt={""}
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
        <div ref={purchasePanelRef} className="flex min-w-0 w-full flex-col gap-9 lg:basis-1/2 lg:pl-8">
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
                  unoptimized
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
            <FavoriteButton
              variant="bordered"
              className="h-12 w-12 md:h-14 md:w-14 flex-none border-[#CFC9C0] bg-transparent"
              active={hasItem(product.id ?? product.sku ?? product.title)}
              onToggle={() => {
                const item: WishlistItem = {
                  id: product.id ?? product.sku ?? product.title,
                  name: product.title,
                  category: product.category,
                  price: product.newPrice,
                  originalPrice: product.oldPrice || undefined,
                  discount: product.discount || undefined,
                  badge: product.onSale ? "Sale" : "Còn hàng",
                  badgeTone: product.onSale ? "sale" : "stock",
                  image: product.gallery[0] ?? "/images/p_lc2.png",
                  href: "#",
                };
                if (!hasItem(item.id)) {
                  if (wishlistAnimationRef.current) {
                    wishlistAnimationRef.current();
                    wishlistAnimationRef.current = null;
                  }

                  const target = getVisibleWishlistTarget();

                  if (target) {
                    const animCleanup = playFlightAnimation(target, () => {
                      if (wishlistAnimationRef.current === animCleanup) {
                        wishlistAnimationRef.current = null;
                      }
                    });
                    if (animCleanup) {
                      wishlistAnimationRef.current = animCleanup;
                    }
                  }
                }
                toggleItem(item);
              }}
            />
          </div>

          {/* Size info box */}
          <div className="flex flex-col gap-1 border border-[#CFC9C0] px-6 py-3">
            <span className="text-[14px] font-medium uppercase leading-[20px] text-[#111]">
              {t("sizeDetails")}
            </span>
            <span className="whitespace-pre-line text-[14px] leading-[22px] text-[#111]">
              {product.size || t("updating")}
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
