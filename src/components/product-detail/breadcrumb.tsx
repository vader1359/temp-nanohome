import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumb({
  items,
  current,
}: {
  items: string[];
  current: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 overflow-hidden text-[14px]">
      {items.map((item, index) => (
        <span key={item} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <Link className="text-[#8A8178] hover:text-[#111]" href={index === 0 ? "/" : "/products"}>{item}</Link>
          <ChevronRight className="h-3 w-3 text-[#8A8178]" />
        </span>
      ))}
      <span className="min-w-0 flex-1 truncate text-[#111]" title={current}>{current}</span>
    </nav>
  );
}
