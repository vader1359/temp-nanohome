"use client"

import { cn } from "@/lib/utils"

interface TabItem {
  key: string
  label: string
}

interface UnderlineTabsProps {
  tabs: TabItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

function UnderlineTabs({
  tabs,
  activeKey,
  onChange,
  className,
}: UnderlineTabsProps) {
  return (
    <div className={cn("flex items-center gap-6 border-b border-nh-border", className)}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative pb-3 pt-2 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors",
            tab.key === activeKey
              ? "text-nh-ink after:bg-nh-ink"
              : "text-nh-muted hover:text-nh-ink after:bg-transparent"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export { UnderlineTabs }
export type { TabItem, UnderlineTabsProps }
