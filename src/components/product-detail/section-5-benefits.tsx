import { Truck, Headphones, ShieldCheck, BadgeCheck } from "lucide-react";
import { SectionHeading } from "@/components/shared";
import { benefits } from "./mock-data";

const iconMap: Record<string, React.ElementType> = {
  truck: Truck,
  support: Headphones,
  payment: ShieldCheck,
  warranty: BadgeCheck,
};

export function Section5Benefits() {
  return (
    <section className="flex flex-col items-center bg-white py-12 md:py-[60px]">
      {/* Header */}
      <SectionHeading
        eyebrow="Tại sao lại chọn nanoHome"
        title="Quyền lợi của khách hàng"
      />

      {/* 4 benefit cards */}
      <div className="site-shell mt-[50px] grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {benefits.map((b) => {
          const Icon = iconMap[b.icon] ?? Truck;
          return (
            <div
              key={b.title}
              className="flex flex-col items-center gap-6 bg-[#F5F3F0] p-6 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F3F0]">
                <Icon className="h-6 w-6 text-[#111]" strokeWidth={1.4} />
              </div>
              <h3 className="text-[18px] font-medium text-[#444]">{b.title}</h3>
              <p className="text-[14px] font-normal leading-relaxed text-[#666]">{b.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
