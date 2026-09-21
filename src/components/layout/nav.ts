import {
  Briefcase, CalendarDays, CalendarOff, Calculator, Clock, FileText, Home, Mail,
  NotebookPen, Receipt, Settings, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Other route prefixes that belong to this section (a job's detail page lives under /jobs). */
  aliases?: string[]
}

/** The menu, in the order it is shown. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",       label: "Início",          icon: Home },
  { href: "/logs",            label: "Registro Diário", icon: NotebookPen },
  { href: "/historico",       label: "Jobs",            icon: Briefcase, aliases: ["/jobs"] },
  { href: "/clients",         label: "Clientes",        icon: Users },
  { href: "/invoices",        label: "Invoices",        icon: FileText },
  { href: "/notas-fiscais",   label: "Notas fiscais",   icon: Receipt },
  { href: "/emails",          label: "E-mails",         icon: Mail },
  { href: "/despesas",        label: "Despesas",        icon: Wallet },
  { href: "/contabilidade",   label: "Contabilidade",   icon: Calculator },
  { href: "/agenda",          label: "Calendário",      icon: CalendarDays },
  { href: "/disponibilidade", label: "Disponibilidade", icon: Clock },
  { href: "/folgas",          label: "Folgas",          icon: CalendarOff },
  { href: "/reports",         label: "Relatórios",      icon: TrendingUp },
]

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Configurações", icon: Settings }

/** Pages reachable outside the menu, so the top bar still knows what to call them. */
const EXTRA_TITLES: Record<string, string> = {
  "/metas":      "Metas",
  "/projetos":   "Projetos",
  "/diario":     "Diário",
  "/pipeline":   "Pipeline",
  "/automacoes": "Automações",
}

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/")

export function isNavActive(pathname: string, item: NavItem): boolean {
  return matches(pathname, item.href) || (item.aliases ?? []).some(a => matches(pathname, a))
}

/** The section a path belongs to — what the top bar prints. */
export function sectionTitle(pathname: string): string {
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find(i => isNavActive(pathname, i))
  if (item) return item.label
  const extra = Object.keys(EXTRA_TITLES).find(p => matches(pathname, p))
  return extra ? EXTRA_TITLES[extra] : "Freela Manager"
}
