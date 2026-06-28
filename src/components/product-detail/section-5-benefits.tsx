import { Truck, Headphones, ShieldCheck, BadgeCheck } from "lucide-react";
import { benefits } from "./mock-data";

const iconMap: Record<string, React.ElementType> = {
  truck: Truck,
  support: Headphones,
  payment: ShieldCheck,
  warranty: BadgeCheck,
};

export function Section5Benefits() {
  return (
    <section className="flex flex-col items-center bg-white px-8 py-[60px]">
      {/* Header */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-[14px] font-medium uppercase text-[#444]">
          Tại sao lại chọn nanoHome
        </span>
        <h2 className="text-center text-[32px] font-medium text-[#444]">
          Quyền lợi của khách hàng
        </h2>
      </div>

      {/* 4 benefit cards */}
      <div className="mt-[50px] flex w-full max-w-[1200px] flex-col gap-6 md:flex-row">
        {benefits.map((b) => {
          const Icon = iconMap[b.icon] ?? Truck;
          return (
            <div
              key={b.title}
              className="flex flex-1 flex-col items-center gap-6 p-6 text-center"
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