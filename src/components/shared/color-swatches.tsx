"use client"

import { cn } from "@/lib/utils"

export interface SwatchColor {
  /** Hex color value */
  color: string
  /** Optional name for tooltip/aria-label */
  name?: string
}

export interface ColorSwatchesProps {
  colors: SwatchColor[]
  /** "grid" = 14-square bordered swatches (featured-products), "dots" = small non-interactive circles (product-card), "selector" = large selectable circles (color-selector) */
  variant?: "grid" | "dots" | "selector"
  /** For selector variant: currently selected color hex */
  selectedColor?: string
  /** For selector variant: callback when a color is selected */
  onSelect?: (color: string) => void
  className?: string
}

export function ColorSwatches({
  colors,
  variant = "dots",
  selectedColor,
  onSelect,
  className,
}: ColorSwatchesProps) {
  if (variant === "grid") {
    return (
      <div className={cn("grid gap-1", className)} style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
        {colors.map((c, i) => (
          <div
            key={`${c.color}-${i}`}
            className="h-3.5 border border-black"
            style={{ backgroundColor: c.color }}
            aria-label={c.name}
          />
        ))}
      </div>
    )
  }

  if (variant === "selector") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {colors.map((c, i) => (
          <button
            type="button"
            key={`${c.color}-${i}`}
            onClick={() => onSelect?.(c.color)}
            aria-label={c.name ?? c.color}
            className={cn(
              "size-8 rounded-full transition-all",
              c.color.toLowerCase() === "#ffffff" || c.color.toLowerCase() === "#fff"
                ? "border border-nh-border"
                : "",
              selectedColor === c.color ? "ring-1 ring-nh-ink" : "",
            )}
            style={{ backgroundColor: c.color }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {colors.map((c, i) => (
        <span
          key={`${c.color}-${i}`}
          className="h-3.5 w-3.5 rounded-full border border-nh-border"
          style={{ backgroundColor: c.color }}
          aria-label={c.name}
        />
      ))}
    </div>
  )
}
