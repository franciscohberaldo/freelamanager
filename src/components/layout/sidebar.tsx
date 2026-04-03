"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3, Briefcase, CalendarDays, ClipboardList,
  FileText, LayoutDashboard, LogOut, Moon, Settings,
  Sun, TrendingUp, Users,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const navItems = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/logs",       label: "Registro Diário", icon: ClipboardList },
  { href: "/jobs",       label: "Jobs",          icon: Briefcase },
  { href: "/clients",    label: "Clientes",      icon: Users },
  { href: "/invoices",   label: "Invoices",      icon: FileText },
  { href: "/agenda",     label: "Acomp. de Jobs", icon: CalendarDays },
  { href: "/reports",    label: "Relatórios",    icon: TrendingUp },
  { href: "/settings",   label: "Configurações", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-64 border-r bg-card min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="w-4 h-4" />
        </div>
        <span className="font-bold text-lg">Freela Manager</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

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
  )
}
