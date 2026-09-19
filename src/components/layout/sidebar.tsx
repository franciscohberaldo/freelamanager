"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { NAV_ITEMS, SETTINGS_ITEM, isNavActive, type NavItem } from "./nav"
import type { AttentionCounts } from "@/hooks/use-attention-counts"

const COLLAPSED_KEY = "sidebar:collapsed"

interface Props {
  counts: AttentionCounts
}

/**
 * The menu: brand on top, every section as a plain row, settings and sign-out at the foot.
 * Collapses to icons; the choice is remembered in this browser.
 */
export function Sidebar({ counts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1") } catch { /* private mode */ }
  }, [])

  function toggle() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1") } catch { /* private mode */ }
      return !c
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const badgeFor = (href: string) =>
    href === "/invoices" ? counts.overdueInvoices :
    href === "/clients"  ? counts.stalledDeals : 0

  const Item = ({ item }: { item: NavItem }) => {
    const active = isNavActive(pathname, item)
    const badge = badgeFor(item.href)
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 h-10 rounded-lg px-3 text-[15px] transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-accent text-accent-foreground font-medium"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {badge > 0 && (
          collapsed
            ? <span className="absolute ml-5 -mt-5 w-2 h-2 rounded-full bg-destructive" />
            : <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] justify-center">{badge}</Badge>
        )}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        "relative flex flex-col shrink-0 h-full bg-card border-r transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-3 h-16 px-4", collapsed && "justify-center px-0")}>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-bold tracking-tight shrink-0">
          FM
        </div>
        {!collapsed && <span className="font-semibold text-[17px] tracking-tight">Freela Manager</span>}
      </div>

      {/* Collapse handle, riding the sidebar's edge */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3.5 top-[76px] z-10 flex items-center justify-center w-7 h-7 rounded-md border bg-card text-muted-foreground shadow-sm hover:text-foreground hover:bg-muted transition-colors"
      >
        {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
      </button>

      {/* Sections */}
      <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "px-2" : "px-3")}>
        {NAV_ITEMS.map(item => <Item key={item.href} item={item} />)}
      </nav>

      {/* Foot */}
      <div className={cn("py-4 space-y-1 border-t", collapsed ? "px-2" : "px-3")}>
        <Item item={SETTINGS_ITEM} />
        <button
          type="button"
          onClick={handleSignOut}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "w-full flex items-center gap-3 h-10 rounded-lg px-3 text-[15px] text-foreground/80 hover:bg-muted hover:text-foreground transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
