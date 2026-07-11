import { BadgeCheck, Headphones, type LucideIcon, ShieldCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "@/components/shared";

type BenefitMessageKey =
  | "benefitDelivery"
  | "benefitSupport"
  | "benefitPayment"
  | "benefitWarranty";

interface BenefitDefinition {
  readonly icon: LucideIcon;
  readonly key: BenefitMessageKey;
}

const benefits: readonly BenefitDefinition[] = [
  { icon: Truck, key: "benefitDelivery" },
  { icon: Headphones, key: "benefitSupport" },
  { icon: ShieldCheck, key: "benefitPayment" },
  { icon: BadgeCheck, key: "benefitWarranty" },
];

export function Section5Benefits() {
  const t = useTranslations("ProductDetail");

  return (
    <section className="flex flex-col items-center bg-white py-12 md:py-[60px]">
      <SectionHeading eyebrow={t("benefitEyebrow")} title={t("benefitTitle")} />

      <div className="site-shell mt-[50px] grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {benefits.map(({ icon: Icon, key }) => (
          <div key={key} className="flex flex-col items-center gap-6 bg-[#F5F3F0] p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F3F0]">
              <Icon className="h-6 w-6 text-[#111]" strokeWidth={1.4} />
            </div>
            <h3 className="text-[18px] font-medium text-[#444]">{t(`${key}Title`)}</h3>
            <p className="text-[14px] font-normal leading-relaxed text-[#666]">{t(`${key}Description`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
