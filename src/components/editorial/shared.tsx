import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/types/db";

export function textValue(value: string | null | undefined, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function detailSlug(value: string | null, fallback: string): string {
  return encodeURIComponent(textValue(value, fallback));
}

export function formatDate(value: string | null, locale: string): string {
  if (value === null) {
    return locale === "vi" ? "Đang cập nhật" : "Updating";
  }

  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function EditorialHeader({
  eyebrow,
  title,
  description,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description?: string;
}>) {
  return (
    <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
      {eyebrow ? <p className="text-[14px] font-medium uppercase leading-5 tracking-[0.08em] text-nh-muted">{eyebrow}</p> : null}
      <h1 className="text-[32px] font-medium leading-[40px] text-nh-ink md:text-[40px] md:leading-[48px]">{title}</h1>
      {description ? <p className="max-w-2xl text-[14px] font-normal leading-[22px] text-nh-muted">{description}</p> : null}
    </header>
  );
}

export function ImageFrame({
  src,
  alt,
  ratio = "aspect-[4/3]",
  className = "",
}: Readonly<{
  src: string | null | undefined;
  alt: string;
  ratio?: string;
  className?: string;
}>) {
  return (
    <div className={`${ratio} overflow-hidden bg-[#e1e1e1] ${className}`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.03]" /> : null}
    </div>
  );
}

export type ListingCardItem = {
  readonly href: string;
  readonly imageUrl: string | null;
  readonly title: string;
  readonly meta: string;
  readonly description?: string | null;
};

export function ListingCard({ item, feature = false, compact = false }: Readonly<{ item: ListingCardItem; compact?: boolean; feature?: boolean }>) {
  if (compact) {
    return (
      <article className="group min-w-0 border-b border-nh-border pb-6 last:border-b-0 last:pb-0">
        <Link href={item.href} className="grid grid-cols-[132px_1fr] gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
          <ImageFrame src={item.imageUrl} alt={item.title} ratio="aspect-[132/92]" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[12px] leading-[18px] text-nh-muted">{item.meta}</p>
            <h2 className="line-clamp-2 text-[16px] font-medium leading-6 text-nh-ink">{item.title}</h2>
            {item.description ? <p className="line-clamp-2 text-[13px] leading-5 text-nh-muted">{item.description}</p> : null}
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group min-w-0">
      <Link href={item.href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
        <ImageFrame src={item.imageUrl} alt={item.title} ratio={feature ? "aspect-[888/495]" : "aspect-[432/260]"} />
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[12px] leading-[18px] text-nh-muted">{item.meta}</p>
          <h2 className={feature ? "text-[24px] font-medium leading-8 text-nh-ink" : "text-[18px] font-medium leading-7 text-nh-ink"}>{item.title}</h2>
          {item.description ? <p className="line-clamp-3 text-[14px] leading-[22px] text-nh-muted">{item.description}</p> : null}
        </div>
      </Link>
    </article>
  );
}

export function SectionTitleLink({ title, href }: Readonly<{ title: string; href?: string }>) {
  const content = (
    <span className="inline-flex items-center gap-2 text-[24px] font-medium leading-8 text-nh-ink">
      {title}
      <ArrowUpRight className="size-5" aria-hidden="true" />
    </span>
  );

  return (
    <div className="border-t border-nh-border pt-6">
      {href ? <Link href={href}>{content}</Link> : content}
    </div>
  );
}

export function ProductStrip({
  products,
  title,
  fallbackProductName,
  fallbackProductDescription,
}: Readonly<{
  products: readonly Product[];
  title: string;
  fallbackProductName: string;
  fallbackProductDescription: string;
}>) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mt-16 w-full max-w-[1344px] px-4 sm:px-6 lg:px-12">
      <div className="border-t border-nh-border pt-6">
        <h2 className="text-[24px] font-medium leading-8 text-nh-ink">{title}</h2>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {products.slice(0, 3).map((product) => (
          <article key={product.id} className="bg-white p-5">
            <h3 className="text-[16px] font-medium leading-6 text-nh-ink">{textValue(product.name_vi, textValue(product.name, fallbackProductName))}</h3>
            <p className="mt-2 line-clamp-3 text-[14px] leading-[22px] text-nh-muted">{textValue(product.description_vi, textValue(product.description, fallbackProductDescription))}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
