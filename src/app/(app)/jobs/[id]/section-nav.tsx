"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type Section = { id: string; label: string; count?: string }

/**
 * The page is one long scroll, so this is how you get around it: a bar of anchors that
 * marks where you are. The observer's bottom margin keeps the last section from stealing
 * the mark the moment it peeks in — whatever sits at the top of the viewport wins.
 */
export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id)
  const ids = sections.map(s => s.id).join()

  useEffect(() => {
    const elements = ids.split(",")
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)

    const observer = new IntersectionObserver(
      entries => {
        const onScreen = entries.filter(e => e.isIntersecting)
        if (!onScreen.length) return
        const top = onScreen.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0]
        setActive(top.target.id)
      },
      { rootMargin: "-72px 0px -55% 0px" },
    )
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return (
    <nav className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/90 backdrop-blur border-b flex gap-1 overflow-x-auto">
      {sections.map(s => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
            active === s.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {s.label}
          {s.count && <span className="ml-1.5 text-xs opacity-70">{s.count}</span>}
        </a>
      ))}
    </nav>
  )
}
