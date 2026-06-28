"use client"

import { cn } from "@/lib/utils"

export interface PaginationDotsProps {
  /** Total number of dots */
  count: number
  /** Currently active dot index (0-based) */
  activeIndex: number
  /** Called when a dot is clicked */
  onSelect?: (index: number) => void
  className?: string
}

export function PaginationDots({
  count,
  activeIndex,
  onSelect,
  className,
}: PaginationDotsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {Array.from({ length: count }, (_, i) =>
        onSelect ? (
          <button
            type="button"
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i === activeIndex ? "bg-nh-ink" : "bg-nh-border",
            )}
          />
        ) : (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i === activeIndex ? "bg-nh-ink" : "bg-nh-border",
            )}
          />
        ),
      )}
    </div>
  )
}
