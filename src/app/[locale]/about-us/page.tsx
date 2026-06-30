import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditorialHeader } from "@/components/editorial/shared";

const values = [
  {
    title: "Tiên phong – Pioneering",
    body: "Từ ngày đầu thành lập, nanoHome đã chọn con đường tiên phong: kết nối trực tiếp với các thương hiệu nội thất châu Âu, đưa tiêu chuẩn nguyên bản vào không gian sống Việt Nam.",
    quote: "Nhà bán lẻ nội thất cao cấp đầu tiên và duy nhất tại Việt Nam hợp tác trực tiếp với nhiều thương hiệu biểu tượng của châu Âu.",
  },
  {
    title: "Nguyên bản – Authentic",
    body: "Mỗi sản phẩm được tuyển chọn dựa trên nguồn gốc, chất lượng, câu chuyện thiết kế và khả năng đồng hành lâu dài với người sử dụng.",
    quote: "Sự sang trọng bền vững bắt đầu từ tính nguyên bản.",
  },
  {
    title: "Chăm sóc – Caring",
    body: "nanoHome không chỉ bán sản phẩm. Chúng tôi tư vấn, hoàn thiện, bảo hành và chăm sóc trải nghiệm sống đẹp trong từng chi tiết.",
    quote: "Một không gian đẹp cần được chăm sóc như một mối quan hệ lâu dài.",
  },
] as const;

export default async function AboutUsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "About" });

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1344px] flex-col gap-12 px-4 py-[60px] sm:px-6 lg:px-12">
        <EditorialHeader eyebrow={t("eyebrow")} title={t("heading")} />
        <div className="group relative aspect-[1360/615] overflow-hidden bg-[#e1e1e1]">
          <img src="/images/about_img.png" alt="Không gian nội thất cao cấp nanoHome" className="h-full w-full object-cover" />
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
            <span className="size-2 rounded-full bg-white" />
            <span className="size-2 rounded-full border border-white" />
            <span className="size-2 rounded-full border border-white" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1116px] gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[369px_1fr] lg:px-0">
        <p className="text-[24px] font-normal leading-8 text-nh-ink">{t("leftHeading")}</p>
        <div className="border-nh-border text-[14px] leading-[22px] text-nh-muted lg:border-l lg:pl-10">
          <p>{t("p1")}</p>
          <p className="mt-5">{t("p2")}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1116px] gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_456px] lg:px-0">
        <div>
          <h2 className="text-[32px] font-medium leading-[40px] text-nh-ink">Giá trị cốt lõi của nanoHome</h2>
          <div className="mt-10 divide-y divide-nh-border border-y border-nh-border">
            {values.map((value) => (
              <article key={value.title} className="py-6">
                <h3 className="text-[18px] font-medium leading-7 text-nh-ink">{value.title}</h3>
                <p className="mt-4 text-[14px] leading-[22px] text-nh-muted">{value.body}</p>
                <p className="mt-4 text-[14px] italic leading-[22px] text-nh-ink">“{value.quote}”</p>
              </article>
            ))}
          </div>
        </div>
        <div className="aspect-[456/620] overflow-hidden bg-[#e1e1e1]">
          <img src="/images/featured-living-room.png" alt="Chi tiết không gian sống nanoHome" className="h-full w-full object-cover" />
        </div>
      </section>
    </main>
  );
}
