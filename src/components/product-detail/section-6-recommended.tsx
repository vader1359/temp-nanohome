import { ProductCard } from "./product-card";
import { recommended as fallbackRecommended, type RelatedProduct } from "./mock-data";

interface Section6RecommendedProps {
  products?: RelatedProduct[];
}

export function Section6Recommended({ products = fallbackRecommended }: Section6RecommendedProps) {
  return (
    <section className="flex flex-col gap-8 bg-white px-4 py-12 sm:px-8 md:py-16">
      {/* Header */}
      <h2 className="text-[24px] font-medium text-[#444]">Sản phẩm dành cho bạn</h2>

      {/* Product cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.name} p={p} />
        ))}
      </div>

      {/* Footer link */}
      <div className="text-center">
        <a href="#" className="text-[14px] font-normal text-[#111] hover:underline">
          Xem tất cả
        </a>
      </div>
    </section>
  );
}