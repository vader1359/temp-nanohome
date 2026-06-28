"use client"

import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FavoriteButtonProps {
  active?: boolean
  onToggle?: () => void
  /** Size of the heart icon */
  size?: "sm" | "md" | "lg"
  /** "solid" = bg-white/90 round button (used in product-card), "outline" = just the heart icon (used in inline product grids), "bordered" = heart inside border border-nh-border button (used in section-1-hero CTA row) */
  variant?: "solid" | "outline" | "bordered"
  className?: string
}

const iconSizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
} as const

export function FavoriteButton({
  active = false,
  onToggle,
  size = "md",
  variant = "outline",
  className,
}: FavoriteButtonProps) {
  const iconSize = iconSizes[size]

  if (variant === "solid") {
    return (
      <button
        type="button"
        aria-label="Toggle favorite"
        onClick={onToggle}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-white/90 transition-colors hover:bg-white",
          className,
        )}
      >
        <Heart className={cn(iconSize, active ? "fill-nh-red text-nh-red" : "text-nh-ink")} />
      </button>
    )
  }

  if (variant === "bordered") {
    return (
      <button
        type="button"
        aria-label="Toggle favorite"
        onClick={onToggle}
        className={cn(
          "flex h-10 w-10 items-center justify-center border border-nh-border rounded-full transition-colors hover:bg-nh-muted/10",
          className,
        )}
      >
        <Heart className={cn(iconSize, active ? "fill-nh-ink text-nh-ink" : "text-nh-ink")} />
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label="Toggle favorite"
      onClick={onToggle}
      className={cn("transition-colors", className)}
    >
      <Heart className={cn(iconSize, active ? "fill-nh-ink text-nh-ink" : "text-nh-muted")} />
    </button>
  )
}
