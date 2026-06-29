import { cn } from "@/lib/utils"

interface IconTextRowProps {
  icon: React.ReactNode
  label?: string
  value?: string
  href?: string
  /** Icon container style: "round" = bg-[#F5F3F0] h-12 w-12 circle (benefits style), "inline" = no container just icon size-5 (footer/contact style) */
  iconVariant?: "round" | "inline"
  className?: string
}

function IconTextRow({
  icon,
  label,
  value,
  href,
  iconVariant = "round",
  className,
}: IconTextRowProps) {
  if (iconVariant === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-nh-muted">{icon}</span>
        {value && href ? (
          <a href={href} className="text-sm text-nh-ink hover:text-nh-accent">
            {value}
          </a>
        ) : (
          value && <span className="text-sm text-nh-ink">{value}</span>
        )}
      </div>
    )
  }

  const valueContent = value && href ? (
    <a href={href} className="whitespace-nowrap text-sm text-nh-ink hover:text-nh-accent">
      {value}
    </a>
  ) : (
    value && <p className="whitespace-nowrap text-sm font-medium text-nh-ink">{value}</p>
  )

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full">
        {icon}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {label && <p className="whitespace-nowrap text-sm text-nh-muted">{label}</p>}
        {valueContent}
      </div>
    </div>
  )
}

export { IconTextRow }
export type { IconTextRowProps }
