"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Calendar,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
} from "lucide-react";
import { Breadcrumb, ColorSelector } from "@/components/product-detail";
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
            {product.onSale && (
              <span className="inline-block w-fit bg-[#930000] px-1 py-0.5 text-[12px] font-medium leading-[16px] text-white">
                SALE
              </span>
            )}

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
            <button className="flex grow items-center justify-center gap-2 bg-[#111] px-8 py-4 text-[14px] font-medium uppercase leading-[20px] text-white transition hover:bg-[#333]">
              <ShoppingCart className="h-4 w-4" />
              Thêm vào giỏ
            </button>
            <button
              aria-label="Yêu thích"
              className="flex items-center justify-center border border-[#CFC9C0] px-5 text-[#111] transition hover:border-[#111]"
            >
              <Heart className="h-5 w-5" strokeWidth={1.6} />
            </button>
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
            <ContactItem icon="calendar" label="Đặt lịch hẹn" labelColor="link" />
            <ContactItem
              icon="chat"
              label="Liên hệ"
              value="Chuyên viên tư vấn sản khẩn"
            />
            <ContactItem
              icon="phone"
              label="Đặt hàng qua điện thoại"
              value="1800-1003"
              valueColor="link"
            />
            <ContactItem
              icon="store"
              label="Đang có tại:"
              value="Cassina Store"
              extra="nanoHome Gallery Saigon"
              valueColor="link"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Contact service row ─── */
function ContactItem({
  icon,
  label,
  value,
  extra,
  labelColor,
  valueColor,
}: {
  icon: string;
  label: string;
  value?: string;
  extra?: string;
  labelColor?: "link";
  valueColor?: "link";
}) {
  const link = "text-[#B0946F]";
  const base = "text-[#111]";
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#111]">
        {icon === "calendar" && <Calendar className="h-4 w-4" strokeWidth={1.5} />}
        {icon === "chat" && <MessageCircle className="h-4 w-4" strokeWidth={1.5} />}
        {icon === "phone" && <Phone className="h-4 w-4" strokeWidth={1.5} />}
        {icon === "store" && <MapPin className="h-4 w-4" strokeWidth={1.5} />}
      </span>
      <div className="flex flex-row flex-wrap gap-x-2.5 text-[12px] leading-[18px]">
        <span className={labelColor === "link" ? link : base}>{label}</span>
        {value && (
          <span className={valueColor === "link" ? link : base}>{value}</span>
        )}
        {extra && <span className={link}>{extra}</span>}
      </div>
    </div>
  );
}
