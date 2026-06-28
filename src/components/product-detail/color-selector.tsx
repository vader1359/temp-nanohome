"use client";

import { useState } from "react";
import { COLORS } from "./mock-data";
import { ColorSwatches } from "@/components/shared";
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
      <ColorSwatches
        colors={colors.map((c) => ({ color: c.hex, name: c.name }))}
        variant="selector"
        selectedColor={colors[selected]?.hex}
        onSelect={(color) => {
          const index = colors.findIndex((c) => c.hex === color);
          if (index >= 0) setSelected(index);
        }}
      />
    </div>
  );
}