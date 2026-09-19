"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Bell, LogOut, Moon, Search, Settings, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { sectionTitle } from "./nav"
import type { AttentionCounts } from "@/hooks/use-attention-counts"

interface Props {
  email: string
  counts: AttentionCounts
}

/** Opens the global search the same way the keyboard does. */
function openSearch() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }))
}

/**
 * The strip above the page: which section you are in, and the three things that follow
 * you everywhere — search, what needs attention, and your account.
 */
export function Topbar({ email, counts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const attention = counts.overdueInvoices + counts.stalledNfs
  const initial = (email[0] ?? "U").toUpperCase()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between h-16 shrink-0 px-8 bg-card border-b">
      <h2 className="text-xl font-semibold tracking-tight">{sectionTitle(pathname)}</h2>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Buscar (⌘K)" className="text-muted-foreground hover:text-foreground">
          <Search className="w-5 h-5" strokeWidth={1.75} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="O que precisa de atenção" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {attention > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Conta"
              className="ml-2 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Conectado como</p>
              <p className="truncate text-sm">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="w-4 h-4" /> Configurações</Link>
            </DropdownMenuItem>
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
    </header>
  )
}
