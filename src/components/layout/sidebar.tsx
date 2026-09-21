"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Bell, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NAV_ITEMS, SETTINGS_ITEM, isNavActive, type NavItem } from "./nav"
import type { AttentionCounts } from "@/hooks/use-attention-counts"

const COLLAPSED_KEY = "sidebar:collapsed"

interface Props {
  email: string
  counts: AttentionCounts
}

/** Opens the global search the same way the keyboard does. */
function openSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }))
}

/**
 * The menu: brand and search on top, every section as a plain row, and at the foot
 * what used to sit on the removed top bar — attention, settings and the account.
 * Collapses to icons; the choice is remembered in this browser.
 */
export function Sidebar({ email, counts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
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

  const attention = counts.overdueInvoices + counts.stalledNfs
  const initial = (email[0] ?? "U").toUpperCase()

  const badgeFor = (href: string) =>
    href === "/invoices" ? counts.overdueInvoices :
    href === "/clients"  ? counts.stalledDeals : 0

  const rowClass = "w-full flex items-center gap-3 h-10 rounded-lg px-3 text-[15px] text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"

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

      {/* Search — moved here from the removed top bar */}
      <div className={cn("pb-1", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={openSearch}
          title={collapsed ? "Buscar (⌘K)" : undefined}
          className={cn(rowClass, collapsed && "justify-center px-0")}
        >
          <Search className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="flex-1 text-left">Buscar</span>}
          {!collapsed && <kbd className="text-[10px] font-sans text-muted-foreground border rounded px-1 py-0.5">⌘K</kbd>}
        </button>
      </div>

      {/* Sections */}
      <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "px-2" : "px-3")}>
        {NAV_ITEMS.map(item => <Item key={item.href} item={item} />)}
      </nav>

      {/* Foot */}
      <div className={cn("py-4 space-y-1 border-t", collapsed ? "px-2" : "px-3")}>
        {/* What needs attention — moved here from the removed top bar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={collapsed ? "O que precisa de atenção" : undefined}
              className={cn(rowClass, collapsed && "justify-center px-0")}
            >
              <span className="relative shrink-0">
                <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
                {attention > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />}
              </span>
              {!collapsed && <span className="flex-1 text-left">Pendências</span>}
              {!collapsed && attention > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] justify-center">{attention}</Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-72">
            <DropdownMenuLabel>Precisa de atenção</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {attention === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nada pendente. Invoices em dia e notas fiscais emitidas.</p>
            )}
            {counts.overdueInvoices > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/invoices" className="flex justify-between gap-3">
                  <span>{counts.overdueInvoices === 1 ? "Invoice vencida" : "Invoices vencidas"}</span>
                  <span className="font-semibold tabular">{counts.overdueInvoices}</span>
                </Link>
              </DropdownMenuItem>
            )}
            {counts.stalledNfs > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/notas-fiscais" className="flex justify-between gap-3">
                  <span>{counts.stalledNfs === 1 ? "Nota fiscal parada há mais de 7 dias" : "Notas fiscais paradas há mais de 7 dias"}</span>
                  <span className="font-semibold tabular">{counts.stalledNfs}</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Item item={SETTINGS_ITEM} />

        {/* Account — "Conectado como", theme and sign-out */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={collapsed ? email : undefined}
              className={cn(rowClass, collapsed && "justify-center px-0")}
            >
              <span className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                {initial}
              </span>
              {!collapsed && <span className="flex-1 truncate text-left text-sm">{email}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Conectado como</p>
              <p className="truncate text-sm">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="w-4 h-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
