"use client";

import Image from "next/image";
import { ProductCard, toWishlistItem, type ProductGridItem } from "@/components/products/product-card";
import { useWishlist } from "@/components/wishlist/wishlist-context";
import { variantToProductGridItem } from "@/lib/products/mapper";
import type { HomepageCmsSection } from "@/lib/queries/homepage-cms";

function safeLocalHref(href: string | null): string | null {
  return href !== null && href.startsWith("/") && !href.startsWith("//") ? href : null;
}

function CurationCard({ product }: Readonly<{ readonly product: ProductGridItem }>) {
  const { hasItem, toggleItem } = useWishlist();
  return <ProductCard product={product} isFavorite={hasItem(product.id)} onToggleFavorite={() => toggleItem(toWishlistItem(product))} />;
}

export function CmsProductCuration({ section }: Readonly<{ readonly section: Extract<HomepageCmsSection, { readonly type: "product_curation" }> }>) {
  if (section.items.length === 0) return null;
  const products = section.items.map((item) => variantToProductGridItem(item));
  return (
    <section data-section="cms-product-curation" className="bg-nh-surface-warm py-12 sm:py-16 lg:py-20">
      <div className="site-shell">
        <h2 className="mb-8 text-2xl font-medium leading-8 text-nh-ink sm:mb-10">{section.title}</h2>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {products.map((product) => <CurationCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}

export function CmsContentCarousel({ section }: Readonly<{ readonly section: Extract<HomepageCmsSection, { readonly type: "content_carousel" }> }>) {
  if (section.items.length === 0) return null;
  return (
    <section data-section="cms-content-carousel" className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="site-shell">
        <h2 className="mb-8 text-2xl font-medium leading-8 text-nh-ink sm:mb-10">{section.title}</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => {
            const href = safeLocalHref(item.href);
            const content = <><div className="relative aspect-[4/3] w-full overflow-hidden"><Image src={item.media.delivery_url} alt={item.media.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" /></div><div className="pt-4"><h3 className="text-lg font-medium leading-7 text-nh-ink">{item.title ?? ""}</h3>{item.body && <p className="mt-2 text-sm leading-5 text-nh-muted">{item.body}</p>}</div></>;
            return <article key={item.id} className="min-w-0">{href ? <a href={href} className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">{content}</a> : content}</article>;
          })}
        </div>
      </div>
    </section>
  );
}
