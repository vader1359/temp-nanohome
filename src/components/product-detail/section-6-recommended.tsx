import { SectionHeading } from "@/components/shared";
import { ProductCard } from "./product-card";
import { recommended } from "./mock-data";

export function Section6Recommended() {
  return (
    <section className="flex flex-col gap-8 bg-white px-4 py-12 sm:px-8 md:py-16">
      {/* Header */}
      <SectionHeading title="Sản phẩm dành cho bạn" align="left" />

      {/* Product cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {recommended.map((p) => (
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