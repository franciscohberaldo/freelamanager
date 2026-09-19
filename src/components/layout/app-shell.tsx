"use client"

import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { CommandPalette } from "@/components/command-palette"
import { useAttentionCounts } from "@/hooks/use-attention-counts"

/** Sidebar on the left; top bar and the scrolling page on the right. */
export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const counts = useAttentionCounts()
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar counts={counts} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar email={email} counts={counts} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      {/* Global search — mounted once, opened by ⌘K or the top-bar button */}
      <CommandPalette />
    </div>
  )
}
