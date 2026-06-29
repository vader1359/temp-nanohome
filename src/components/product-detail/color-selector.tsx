"use client";

import { useState } from "react";
import { COLORS } from "./mock-data";
import { cn } from "@/lib/utils";

export function ColorSelector({
  header = "MÀU SẮC:",
  colors = COLORS,
  className,
}: {
  header?: string;
  colors?: { name: string; hex: string }[];
  className?: string;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-[14px] font-medium uppercase text-[#111]">{header}</span>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <button
            key={c.name}
            type="button"
            aria-label={c.name}
            title={c.name}
            onClick={() => setSelected(i)}
            className={cn(
              "flex min-h-[44px] min-w-[44px] items-center justify-center p-1 transition",
              selected === i ? "ring-1 ring-[#111]" : "ring-0",
            )}
            style={{ background: "transparent" }}
          >
            <span
              className="block size-6"
              style={{
                background: c.hex,
                border: c.hex.toLowerCase() === "#e8e8e8" ? "1px solid #ddd" : undefined,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}