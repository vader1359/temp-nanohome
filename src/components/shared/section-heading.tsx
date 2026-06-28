import { cn } from "@/lib/utils"

export interface SectionHeadingProps {
  /** Small uppercase label above the title */
  eyebrow?: string
  /** Main heading text */
  title: string
  /** Text alignment, default "center" */
  align?: "center" | "left"
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-nh-muted">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-2xl font-semibold text-nh-ink md:text-3xl">{title}</h2>
    </div>
  )
}
