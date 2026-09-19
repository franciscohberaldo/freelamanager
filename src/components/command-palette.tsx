"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Search, Briefcase, Users, FileText, LayoutDashboard, ClipboardList, CalendarDays, CalendarOff, Clock, Calculator, Settings, TrendingUp, Wallet, Receipt } from "lucide-react"

interface Result {
  id: string
  label: string
  sub?: string
  href: string
  icon: React.ElementType
  category: string
}

const STATIC_LINKS: Result[] = [
  { id: "dash",    label: "Dashboard",        href: "/dashboard", icon: LayoutDashboard, category: "Páginas" },
  { id: "logs",    label: "Registro Diário",  href: "/logs",      icon: ClipboardList,   category: "Páginas" },
  { id: "jobs",    label: "Jobs",             href: "/historico", icon: Briefcase,       category: "Páginas" },
  { id: "clients", label: "Clientes",         href: "/clients",   icon: Users,           category: "Páginas" },
  { id: "inv",     label: "Invoices",         href: "/invoices",  icon: FileText,        category: "Páginas" },
  { id: "nf",      label: "Notas fiscais",    href: "/notas-fiscais", icon: Receipt,     category: "Páginas" },
  { id: "desp",    label: "Despesas",         href: "/despesas",  icon: Wallet,          category: "Páginas" },
  { id: "conta",   label: "Contabilidade",    href: "/contabilidade", icon: Calculator,  category: "Páginas" },
  { id: "agenda",  label: "Calendário",       href: "/agenda",    icon: CalendarDays,    category: "Páginas" },
  { id: "disp",    label: "Disponibilidade",  href: "/disponibilidade", icon: Clock,     category: "Páginas" },
  { id: "folgas",  label: "Folgas",           href: "/folgas",    icon: CalendarOff,     category: "Páginas" },
  { id: "reports", label: "Relatórios",       href: "/reports",   icon: TrendingUp,      category: "Páginas" },
  { id: "settings",label: "Configurações",    href: "/settings",  icon: Settings,        category: "Páginas" },
]

export function CommandPalette() {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState<Result[]>(STATIC_LINKS)
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null
    })
  }, [])

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults(STATIC_LINKS)
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search Supabase when query changes
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults(STATIC_LINKS)
      setSelected(0)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const q = query.toLowerCase()
      const userId = userIdRef.current

      const jobsQuery = supabase.from("jobs").select("id, name").ilike("name", `%${q}%`).limit(4)
      const clientsQuery = supabase.from("clients").select("id, name, company, email").or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`).limit(4)
      const invoicesQuery = supabase.from("invoices").select("id, invoice_number, status").or(`invoice_number.ilike.%${q}%,status.ilike.%${q}%`).limit(4)

      if (userId) {
        jobsQuery.eq("user_id", userId)
        clientsQuery.eq("user_id", userId)
        invoicesQuery.eq("user_id", userId)
      }

      const [{ data: jobs }, { data: clients }, { data: invoices }] =
        await Promise.all([jobsQuery, clientsQuery, invoicesQuery])

      const dynamic: Result[] = [
        ...(jobs ?? []).map(j => ({
          id: `job-${j.id}`, label: j.name, href: `/jobs`,
          icon: Briefcase, category: "Jobs",
        })),
        ...(clients ?? []).map(c => ({
          id: `cli-${c.id}`, label: c.name, sub: c.company ?? undefined,
          href: `/clients/${c.id}`, icon: Users, category: "Clientes",
        })),
        ...(invoices ?? []).map(inv => ({
          id: `inv-${inv.id}`, label: `Invoice #${inv.invoice_number}`,
          sub: inv.status, href: `/invoices`, icon: FileText, category: "Invoices",
        })),
      ]

      // Filter static links by query
      const staticFiltered = STATIC_LINKS.filter(l =>
        l.label.toLowerCase().includes(q)
      )

      setResults([...staticFiltered, ...dynamic])
      setSelected(0)
      setLoading(false)
    }, 200)
  }, [query])

  // Keyboard navigation
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault()
      router.push(results[selected].href)
      setOpen(false)
    }
  }, [results, selected, router])

  // Group results by category
  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {})

  let itemIndex = 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <DialogDescription className="sr-only">Busque por páginas, jobs, clientes e projetos</DialogDescription>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, jobs, clientes..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin shrink-0" />
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum resultado encontrado
            </p>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {category}
              </p>
              {items.map(item => {
                const isSelected = itemIndex === selected
                const currentIndex = itemIndex++
                return (
                  <button
                    key={item.id}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                      isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                    ].join(" ")}
                    onClick={() => { router.push(item.href); setOpen(false) }}
                    onMouseEnter={() => setSelected(currentIndex)}
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.sub && (
                      <span className="text-xs text-muted-foreground">{item.sub}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="bg-muted px-1 rounded">Esc</kbd> fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
