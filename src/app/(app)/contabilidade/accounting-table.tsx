"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { reorder, mergeColumnOrder } from "@/lib/column-order"
import {
  ACCOUNTING_KINDS, ACCOUNTING_LABELS, ACCOUNTING_SHORT_LABELS,
  formatCompetencia, type AccountingKind, type CompetenciaScope,
} from "@/lib/accounting-documents"
import { Check, GripVertical, Paperclip, RotateCcw } from "lucide-react"

export type CompetenciaRow = {
  competencia: string
  scope: CompetenciaScope
  counts: Record<AccountingKind, number>
  total: number
}

const ORDER_STORAGE_KEY = "contabilidade:column-order"

type Column = {
  key: string
  label: string
  align?: "center" | "right"
  title?: string
  icon?: React.ElementType
  cell: (row: CompetenciaRow) => React.ReactNode
}

const BASE_COLUMNS: Column[] = [
  {
    key: "competencia", label: "Competência",
    cell: row => (
      <Link href={`/contabilidade/${row.competencia}`} className="font-medium hover:underline">
        {formatCompetencia(row.competencia, row.scope)}
      </Link>
    ),
  },
]

/** Generated from ACCOUNTING_KINDS, so a kind added later becomes a column on its own. */
const KIND_COLUMNS: Column[] = ACCOUNTING_KINDS.map(kind => ({
  key: `doc_${kind}`,
  label: ACCOUNTING_SHORT_LABELS[kind],
  icon: Paperclip,
  align: "center" as const,
  title: ACCOUNTING_LABELS[kind],
  cell: (row: CompetenciaRow) => {
    const n = row.counts[kind] ?? 0
    if (n === 0) return <span className="text-muted-foreground/40">—</span>
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600">
        <Check className="w-4 h-4" aria-label="anexado" />
        {n > 1 && <span className="text-xs">{n}</span>}
      </span>
    )
  },
}))

const COLUMNS = [...BASE_COLUMNS, ...KIND_COLUMNS]
const DEFAULT_ORDER = COLUMNS.map(c => c.key)

const alignClass = (align: Column["align"]) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

export function AccountingTable({ rows }: { rows: CompetenciaRow[] }) {
  const [year, setYear] = useState("all")
  const [missing, setMissing] = useState("all")
  const [query, setQuery] = useState("")
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY)
      if (raw) setOrder(mergeColumnOrder(JSON.parse(raw), DEFAULT_ORDER))
    } catch {
      // a corrupt or unavailable store just means the default order
    }
  }, [])

  function saveOrder(next: string[]) {
    setOrder(next)
    try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function onDrop(targetKey: string) {
    if (dragging && dragging !== targetKey) {
      saveOrder(reorder(order, order.indexOf(dragging), order.indexOf(targetKey)))
    }
    setDragging(null)
  }

  function resetOrder() {
    setOrder(DEFAULT_ORDER)
    try { localStorage.removeItem(ORDER_STORAGE_KEY) } catch {}
  }

  const columns = useMemo(
    () => order.map(k => COLUMNS.find(c => c.key === k)).filter((c): c is Column => !!c),
    [order],
  )
  const reordered = order.join() !== DEFAULT_ORDER.join()

  const years = useMemo(
    () => [...new Set(rows.map(r => r.competencia.slice(0, 4)))].sort().reverse(),
    [rows],
  )

  const q = query.trim().toLowerCase()
  const visible = rows
    .filter(r => year === "all" || r.competencia.startsWith(year))
    .filter(r => missing === "all" || (r.counts[missing as AccountingKind] ?? 0) === 0)
    .filter(r => !q || formatCompetencia(r.competencia, r.scope).includes(q))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar competência"
          className="w-48"
        />
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={missing} onValueChange={setMissing}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tudo</SelectItem>
            {ACCOUNTING_KINDS.map(k => (
              <SelectItem key={k} value={k}>Falta: {ACCOUNTING_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {visible.length} de {rows.length} competências · arraste o cabeçalho para reposicionar
        </p>
        {reordered && (
          <Button variant="ghost" size="sm" onClick={resetOrder}>
            <RotateCcw className="w-3 h-3" />
            Restaurar ordem
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  draggable
                  onDragStart={() => setDragging(c.key)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(c.key)}
                  onDragEnd={() => setDragging(null)}
                  title={c.title}
                  className={[
                    "group p-2 select-none cursor-grab active:cursor-grabbing",
                    alignClass(c.align),
                    dragging === c.key ? "opacity-40" : "",
                    dragging && dragging !== c.key ? "bg-accent/40" : "",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1">
                    <GripVertical className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40" />
                    {c.icon && <c.icon className="w-3 h-3 shrink-0 opacity-50" />}
                    {c.label}
                  </span>
                </th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.competencia} className="border-t">
                {columns.map(c => (
                  <td key={c.key} className={`p-2 whitespace-nowrap ${alignClass(c.align)}`}>
                    {c.cell(row)}
                  </td>
                ))}
                <td className="p-2 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/contabilidade/${row.competencia}`}>Abrir</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">
                  Nenhuma competência nesse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
