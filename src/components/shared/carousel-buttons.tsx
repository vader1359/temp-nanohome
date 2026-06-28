"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CarouselButtonsProps {
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** Visual style: "light" = bg-white/90 (used on images/carousels), "warm" = bg-[#FFF5EB] (used on light warm backgrounds) */
  variant?: "light" | "warm"
  /** Position class for the container, e.g. "top-1/2 -translate-y-1/2" */
  className?: string
}

export function CarouselButtons({
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  variant = "light",
  className,
}: CarouselButtonsProps) {
  const buttonClassName = cn(
    "flex size-10 items-center justify-center rounded-full transition-opacity disabled:pointer-events-none disabled:opacity-30",
    variant === "warm" ? "bg-[#FFF5EB]" : "bg-white/90",
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label="Previous"
        onClick={onPrev}
        disabled={prevDisabled}
        className={buttonClassName}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={onNext}
        disabled={nextDisabled}
        className={buttonClassName}
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
