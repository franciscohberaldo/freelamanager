"use client"

import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { CommandPalette } from "@/components/command-palette"
import { useAttentionCounts } from "@/hooks/use-attention-counts"

/** Sidebar on the left; top bar and the scrolling page on the right. */
export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const counts = useAttentionCounts()
  return (
    // Pinned to the viewport: the page scrolls inside <main>, never the document, so there
    // is one scrollbar whatever a page renders.
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <Sidebar counts={counts} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar email={email} counts={counts} />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
      {/* Global search — mounted once, opened by ⌘K or the top-bar button */}
      <CommandPalette />
    </div>
  )
}
