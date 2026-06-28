import Image from "next/image";
import type { RelatedProduct } from "./mock-data";
import { Chip, FavoriteButton } from "@/components/shared";
import { ColorDots } from "./color-dots";

export function ProductCard({ p }: { p: RelatedProduct }) {
  return (
    <div className="relative flex min-w-0 flex-col bg-white p-4">
      {/* Image block */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-[#F5F3F0]">
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="(max-width:768px) 75vw, 25vw"
          className="object-cover"
        />

        {/* tags - top left */}
        {p.tags && p.tags.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {p.tags.map((tag) => (
              <Chip key={tag} variant="solid" className="w-fit rounded-sm text-[10px] uppercase tracking-[0.04em] shadow-sm">
                {tag}
              </Chip>
            ))}
          </div>
        )}

        {/* favorite - top right */}
        <FavoriteButton
          variant="solid"
          size="sm"
          className="absolute right-3 top-3 shadow-sm"
        />
      </div>

      {/* Text content: tighter line spacing */}
      <div className="mt-4 flex flex-col gap-2 leading-tight">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#666]">
          {p.brand}
        </div>
        <h3 className="line-clamp-2 min-h-[38px] text-[16px] font-normal leading-[19px] text-[#111]">
          {p.name}
        </h3>
        <p className="text-[12px] font-medium leading-[16px] text-[#666]">{p.category}</p>
        <ColorDots />
        <p className="text-[15px] font-semibold leading-[20px] text-[#111]">{p.price}</p>
        {p.available && (
          <span className="text-[12px] font-medium leading-[16px] text-[#00A63E]">
            ĐANG CÓ HÀNG
          </span>
        )}
      </div>
    </div>
  );
}