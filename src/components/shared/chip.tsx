"use client"

import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface ChipProps {
  children: React.ReactNode
  /** "soft" = bg-[#F5F3F0] (warm light, section-3), "outline" = border border-nh-border (AppliedFilters), "solid" = bg-white/90 (product-card tags), "active" = filled with accent */
  variant?: "soft" | "outline" | "solid" | "active"
  /** Optional close/remove button */
  onRemove?: () => void
  className?: string
}

const variantStyles = {
  soft: "bg-[#F5F3F0] text-nh-ink",
  outline: "border border-nh-border text-nh-ink",
  solid: "bg-white/90 text-nh-ink",
  active: "bg-nh-accent text-white",
}

function Chip({
  children,
  variant = "soft",
  onRemove,
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="ml-1"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export { Chip }
export type { ChipProps }
