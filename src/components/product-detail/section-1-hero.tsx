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
import { product, breadcrumbs } from "@/components/product-detail/mock-data";

export function Section1Hero() {
  const [activeThumb, setActiveThumb] = useState(0);

  return (
    <section className="flex flex-col bg-white">
      {/* Breadcrumb */}
      <div className="px-4 py-6 sm:px-8 md:px-12">
        <Breadcrumb items={breadcrumbs} current={product.breadcrumbTitle} />
      </div>

      {/* Content row — gallery left, purchase panel right */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-4 pb-16 sm:px-8 md:px-12 lg:flex-row lg:items-start lg:gap-10">
        {/* ─── Gallery ─── */}
        <div className="flex min-w-0 w-full flex-col gap-2.5 lg:w-auto lg:flex-1 lg:px-[clamp(1rem,6vw,7.125rem)]">
          {/* Main image */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-[#F5F3F0]">
            <Image
              src={product.gallery[activeThumb]}
              alt={product.title}
              fill
              sizes="(max-width:768px) 100vw, 520px"
              className="object-cover"
              priority
            />
          </div>

          {/* Horizontal thumbnail strip */}
          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-sm bg-white p-2 [scrollbar-width:thin]">
            {product.gallery.slice(0, 5).map((src, i) => {
              const active = activeThumb === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveThumb(i)}
                  className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-sm transition-opacity md:w-20 ${
                    active ? "opacity-100" : "opacity-50 hover:opacity-75"
                  }`}
                >
                  <Image
                    src={src}
                    alt={`Thumbnail ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
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
        <div className="flex min-w-0 w-full flex-col gap-9 lg:w-[440px] lg:shrink-0">
          {/* Product Summary */}
          <div className="flex flex-col gap-4">
            {/* Brand logo */}
            <div className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#111]">
              {product.brand}
            </div>

            {/* Title */}
            <h1 className="text-[24px] font-medium leading-[32px] text-[#444]">
              {product.title}
            </h1>

            {/* Category */}
            <p className="text-[12px] leading-[18px] text-[#CFC9C0]">
              {product.category}
            </p>

            {/* SALE badge */}
            {product.onSale && <StatusBadge type="sale" label="SALE" />}

            {/* Price */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[12px] leading-[18px] text-[#666] line-through">
                  {product.oldPrice}
                </span>
                <span className="bg-[#930000] px-0.5 py-0.5 text-[12px] font-medium leading-[16px] text-white">
                  {product.discount}
                </span>
              </div>
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
            <FavoriteButton variant="bordered" className="h-auto rounded-none px-5" />
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
