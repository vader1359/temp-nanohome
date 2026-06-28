import { ChevronRight } from "lucide-react";

export function Breadcrumb({
  items,
  current,
}: {
  items: string[];
  current: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px]">
      {items.map((item) => (
        <span key={item} className="flex items-center gap-2">
          <span className="text-[#CFC9C0]">{item}</span>
          <ChevronRight className="h-3 w-3 text-[#CFC9C0]" />
        </span>
      ))}
      <span className="text-[#111]">{current}</span>
    </nav>
  );
}