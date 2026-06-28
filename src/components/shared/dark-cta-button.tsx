"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"

interface DarkCTAButtonProps extends ButtonPrimitive.Props {
  variant?: "dark" | "solid"
  className?: string
}

const variantStyles = {
  dark: "border border-white bg-nh-ink text-white uppercase tracking-wider hover:bg-white hover:text-nh-ink px-8 py-4",
  solid: "bg-nh-ink text-white uppercase tracking-wider hover:bg-nh-ink/90 px-8 py-4",
}

function DarkCTAButton({
  variant = "dark",
  className,
  ...props
}: DarkCTAButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

export { DarkCTAButton }
export type { DarkCTAButtonProps }
