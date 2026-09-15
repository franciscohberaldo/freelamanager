"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3, Briefcase, CalendarDays, Calculator, ClipboardList,
  FileText, LayoutDashboard, LogOut, Mail, Moon, Receipt, Search, Settings,
  Sun, TrendingUp, Users, Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { CommandPalette } from "@/components/command-palette"

const navItems = [
  { href: "/dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { href: "/logs",      label: "Tracking Diário", icon: ClipboardList },
  // a job's detail page still lives under /jobs, so the entry lights up for it too
  { href: "/historico", label: "Jobs",            icon: Briefcase, alias: "/jobs" },
  { href: "/clients",   label: "Clientes",        icon: Users },
  { href: "/invoices",  label: "Invoices",        icon: FileText },
  { href: "/notas-fiscais", label: "Notas fiscais", icon: Receipt },
  { href: "/emails",    label: "E-mails",         icon: Mail },
  { href: "/despesas",  label: "Despesas",        icon: Wallet },
  { href: "/contabilidade", label: "Contabilidade", icon: Calculator },
  { href: "/agenda",    label: "Agenda",          icon: CalendarDays },
  { href: "/reports",   label: "Relatórios",      icon: TrendingUp },
  { href: "/settings",  label: "Configurações",   icon: Settings },
]

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/")

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()
  const [overdueInvoices, setOverdueInvoices] = useState(0)
  const [stalledDeals, setStalledDeals] = useState(0)

  useEffect(() => {
    async function fetchBadgeCounts() {
      const { count: overdueCount } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "overdue")

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { count: stalledCount } = await supabase
        .from("sales_pipeline")
        .select("*", { count: "exact", head: true })
        .not("stage", "in", '("won","lost")')
        .lt("updated_at", sevenDaysAgo.toISOString())

      setOverdueInvoices(overdueCount ?? 0)
      setStalledDeals(stalledCount ?? 0)
    }

    fetchBadgeCounts()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
    <aside className="flex flex-col w-64 shrink-0 border-r bg-card h-screen overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="w-4 h-4" />
        </div>
        <span className="font-bold text-lg">Freela Manager</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, alias }) => {
          const badgeCount =
            href === "/invoices" ? overdueInvoices :
            href === "/clients" ? stalledDeals : 0

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive(pathname, href) || (!!alias && isActive(pathname, alias))
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] justify-center">
                  {badgeCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Search shortcut */}
      <div className="px-3 pb-2">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground border bg-muted/30 hover:bg-accent transition-colors"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-xs">Buscar...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px] bg-background border rounded px-1">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-1 border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </aside>

    {/* Global command palette — rendered once here, triggered by Cmd+K */}
    <CommandPalette />
    </>
  )
}
