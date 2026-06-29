"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
} from "lucide-react";
import { Breadcrumb, ColorSelector } from "@/components/product-detail";
import { DarkCTAButton, FavoriteButton, IconTextRow, StatusBadge } from "@/components/shared";
import { product as fallbackProduct, breadcrumbs } from "@/components/product-detail/mock-data";

interface Section1HeroProps {
  product?: typeof fallbackProduct & { brandLogoUrl?: string | null };
}

export function Section1Hero({ product = fallbackProduct }: Section1HeroProps) {
  const [activeThumb, setActiveThumb] = useState(0);

  return (
    <section className="flex flex-col overflow-x-hidden bg-white">
      {/* Breadcrumb */}
      <div className="site-shell pb-10 pt-6">
        <Breadcrumb items={breadcrumbs} current={product.breadcrumbTitle} />
      </div>

      {/* Content row — gallery left, purchase panel right */}
      <div className="site-shell max-w-[1280px] flex flex-col items-center gap-10 overflow-hidden pb-16 lg:flex-row lg:items-start lg:gap-12">
        {/* ─── Gallery ─── */}
        <div className="flex min-w-0 w-full flex-col gap-0 lg:basis-1/2 lg:px-0">
          {/* Main image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-white">
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
          <div className="flex w-full min-w-0 -translate-y-1 items-center justify-center gap-1 overflow-x-auto rounded-sm bg-white px-2 pb-1 pt-0 text-center [scrollbar-width:none]">
            {product.gallery.slice(0, 5).map((src, i) => {
              const active = activeThumb === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveThumb(i)}
                  className={`relative aspect-square w-16 min-w-0 shrink-0 overflow-hidden rounded-sm transition-opacity md:w-20 ${
                    active ? "opacity-100" : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <Image
                    src={src}
                    alt={`Thumbnail ${i + 1}`}
                    fill
                    sizes="80px"
                    className="max-w-full object-cover"
                  />
                  {i === 4 && !active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[18px] font-medium leading-[26px] text-white">
                      +3
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
            <Image
              src={product.brandLogoUrl ?? "/images/nanohome-logo.svg"}
              alt={product.brand}
              width={120}
              height={24}
              className="h-[24px] w-auto self-start object-contain object-left"
            />

            {/* Title */}
            <h1 className="break-words text-[20px] font-medium leading-[28px] text-[#444] [overflow-wrap:break-word] sm:text-[24px] sm:leading-[32px]">
              {product.title}
            </h1>

            {/* Category */}
            <p className="text-[12px] leading-[18px] text-[#8A8178]">
              {product.category}
            </p>

            {/* SALE badge */}
            {product.onSale && <StatusBadge type="sale" label="SALE" />}

            {/* Price */}
            <div className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold leading-[20px] text-[#111]">
                {product.newPrice}
              </span>
            </div>

            {/* Color Selector */}
            <ColorSelector />
          </div>

          {/* CTA row */}
          <div className="flex gap-4">
            <DarkCTAButton variant="solid" className="grow gap-2 leading-[20px]">
              <ShoppingCart className="h-4 w-4" />
              Thêm vào giỏ
            </DarkCTAButton>
            <FavoriteButton variant="bordered" className="aspect-square h-auto min-h-full rounded-none px-0" />
          </div>

          {/* Size info box */}
          <div className="flex flex-col gap-1 border border-[#CFC9C0] px-6 py-3">
            <span className="text-[14px] font-medium uppercase leading-[20px] text-[#111]">
              Kích thước
            </span>
            <span className="whitespace-pre-line text-[14px] leading-[22px] text-[#111]">
              {"W 1680 × D 730 × H 620 mm\nChiều cao ngồi: 400 mm"}
            </span>
          </div>

          {/* Contact Service List */}
          <div className="flex flex-col gap-3">
            <IconTextRow
              iconVariant="round"
              icon={<Calendar className="h-4 w-4" strokeWidth={1.5} />}
              value="Đặt lịch hẹn"
              href="#"
            />
            <IconTextRow
              iconVariant="round"
              icon={<MessageCircle className="h-4 w-4" strokeWidth={1.5} />}
              label="Liên hệ"
              value="Chuyên viên tư vấn sản khẩn"
            />
            <IconTextRow
              iconVariant="round"
              icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
              label="Đặt hàng qua điện thoại"
              value="1800-1003"
              href="#"
            />
            <IconTextRow
              iconVariant="round"
              icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}
              label="Đang có tại:"
              value="Cassina Store"
              href="#"
            />
            <span className="pl-[62px] text-sm text-nh-accent">nanoHome Gallery Saigon</span>
          </div>
        </div>
      </div>
    </section>
  );
}
