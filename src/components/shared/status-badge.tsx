import { cn } from "@/lib/utils"

export type StatusType = "sale" | "instock" | "outofstock"

export interface StatusBadgeProps {
  type: StatusType
  /** Custom label, falls back to default per type */
  label?: string
  /** "light" = soft bg (used in products-grid), "solid" = solid bg (used in ProductGrid/product-detail) */
  variant?: "light" | "solid"
  className?: string
}

const defaultLabels: Record<StatusType, string> = {
  sale: "SALE",
  instock: "ĐANG CÓ HÀNG",
  outofstock: "",
}

const variantStyles: Record<NonNullable<StatusBadgeProps["variant"]>, Record<StatusType, string>> = {
  solid: {
    sale: "bg-nh-red text-white",
    instock: "bg-nh-green text-white",
    outofstock: "border border-nh-border bg-white text-nh-muted",
  },
  light: {
    sale: "bg-nh-red/10 text-nh-red",
    instock: "bg-nh-green/10 text-nh-green",
    outofstock: "border border-nh-border bg-white text-nh-muted",
  },
}

export function StatusBadge({ type, label, variant = "solid", className }: StatusBadgeProps) {
  const displayLabel = label ?? defaultLabels[type]

  if (!displayLabel) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantStyles[variant][type],
        className,
      )}
    >
      {displayLabel}
    </span>
  )
}
