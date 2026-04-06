"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { downloadCsv } from "@/lib/csv"
import { format, parseISO, subMonths, addMonths, isValid, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Download, Upload, Loader2, Receipt } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface Expense {
  id: string; user_id: string; category: string; description: string
  amount: number; date: string; notes: string | null; created_at: string
}

interface Props {
  expenses: Expense[]
  yearExpenses: { date: string; amount: number; category: string }[]
  currentMonth: string
}

const CATEGORIES: { value: string; label: string; color: string; emoji: string }[] = [
  { value: "software",  label: "Software/SaaS",    color: "#6366f1", emoji: "💻" },
  { value: "hardware",  label: "Hardware",          color: "#f59e0b", emoji: "🖥️" },
  { value: "curso",     label: "Curso/Educação",    color: "#10b981", emoji: "📚" },
  { value: "imposto",   label: "Imposto/Contador",  color: "#ef4444", emoji: "🧾" },
  { value: "servico",   label: "Serviço/Terceiro",  color: "#3b82f6", emoji: "🔧" },
  { value: "outro",     label: "Outro",             color: "#94a3b8", emoji: "📦" },
]
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function ExpenseDialog({
  expense, open, onClose, onSaved,
}: {
  expense?: Expense; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    description: expense?.description ?? "",
    category:    expense?.category    ?? "software",
    amount:      expense?.amount      ?? 0,
    date:        expense?.date        ?? format(new Date(), "yyyy-MM-dd"),
    notes:       expense?.notes       ?? "",
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) { toast.error("Descrição obrigatória"); return }
    if (!form.amount || form.amount <= 0) { toast.error("Valor inválido"); return }
    setLoading(true)

    const payload = {
      description: form.description,
      category:    form.category,
      amount:      Number(form.amount),
      date:        form.date,
      notes:       form.notes || null,
    }

    if (expense) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id)
      if (error) { toast.error("Erro ao atualizar"); setLoading(false); return }
      toast.success("Despesa atualizada!")
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("expenses").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar"); setLoading(false); return }
      toast.success("Despesa registrada!")
    }

    setLoading(false)
    onClose()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription className="sr-only">Registrar despesa do negócio</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Assinatura Figma" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.amount || ""}
                onChange={e => set("amount", parseFloat(e.target.value) || 0)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
              placeholder="Observações opcionais..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {expense ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── CSV Import Dialog ──────────────────────────────────────────────────────

interface CsvRow { [key: string]: string }

function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""))
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]))
  })
  return { headers, rows }
}

function guessDate(val: string): string {
  // Try dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy
  const fmts = ["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "d/M/yyyy", "dd-MM-yyyy"]
  for (const f of fmts) {
    const d = parse(val, f, new Date())
    if (isValid(d)) return format(d, "yyyy-MM-dd")
  }
  return format(new Date(), "yyyy-MM-dd")
}

function guessAmount(val: string): number {
  // Remove currency symbols and thousands separators
  const clean = val.replace(/[^0-9,.-]/g, "").replace(",", ".")
  return parseFloat(clean) || 0
}

function ImportDialog({ open, onClose, onImported, currentMonth }: {
  open: boolean; onClose: () => void; onImported: () => void; currentMonth: string
}) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload")
  const [headers, setHeaders]   = useState<string[]>([])
  const [rows, setRows]         = useState<CsvRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [colMap, setColMap]     = useState({ date: "", amount: "", description: "", category: "", notes: "" })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { headers: h, rows: r } = parseCsvText(text)
      if (!h.length) { toast.error("CSV inválido ou sem dados"); return }
      setHeaders(h)
      setRows(r)
      // Auto-guess columns
      const lower = h.map(x => x.toLowerCase())
      setColMap({
        date:        h[lower.findIndex(x => x.includes("dat") || x.includes("data"))] ?? "",
        amount:      h[lower.findIndex(x => x.includes("val") || x.includes("amount") || x.includes("valor"))] ?? "",
        description: h[lower.findIndex(x => x.includes("desc") || x.includes("hist") || x.includes("memo"))] ?? "",
        category:    h[lower.findIndex(x => x.includes("cat"))] ?? "",
        notes:       h[lower.findIndex(x => x.includes("obs") || x.includes("note") || x.includes("memo"))] ?? "",
      })
      setStep("map")
    }
    reader.readAsText(file, "UTF-8")
  }

  const preview = useMemo(() => {
    if (!colMap.date || !colMap.amount || !colMap.description) return []
    return rows.slice(0, 5).map(r => ({
      date:        guessDate(r[colMap.date] ?? ""),
      amount:      guessAmount(r[colMap.amount] ?? ""),
      description: r[colMap.description] ?? "",
      category:    r[colMap.category] ? (CATEGORIES.find(c => r[colMap.category]?.toLowerCase().includes(c.value))?.value ?? "outro") : "outro",
      notes:       colMap.notes ? r[colMap.notes] ?? "" : "",
    })).filter(r => r.amount > 0)
  }, [rows, colMap])

  async function handleImport() {
    if (!colMap.date || !colMap.amount || !colMap.description) {
      toast.error("Mapeie as colunas obrigatórias"); return
    }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const toInsert = rows.map(r => ({
      user_id:     user!.id,
      date:        guessDate(r[colMap.date] ?? ""),
      amount:      guessAmount(r[colMap.amount] ?? ""),
      description: r[colMap.description] ?? "Importado",
      category:    r[colMap.category]
        ? (CATEGORIES.find(c => r[colMap.category]?.toLowerCase().includes(c.value))?.value ?? "outro")
        : "outro",
      notes:       colMap.notes ? r[colMap.notes] ?? null : null,
    })).filter(r => r.amount > 0)

    if (!toInsert.length) { toast.error("Nenhum item válido"); setLoading(false); return }

    const { error } = await supabase.from("expenses").insert(toInsert)
    if (error) { toast.error("Erro ao importar: " + error.message); setLoading(false); return }

    toast.success(`${toInsert.length} despesas importadas!`)
    onImported()
    onClose()
    setStep("upload")
    setLoading(false)
  }

  function close() {
    onClose()
    setStep("upload")
    setRows([])
    setHeaders([])
  }

  const ColSelect = ({ field, label, required }: { field: keyof typeof colMap; label: string; required?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && " *"}</Label>
      <Select value={colMap[field] || "none"} onValueChange={v => setColMap(m => ({ ...m, [field]: v === "none" ? "" : v }))}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar despesas via CSV</DialogTitle>
          <DialogDescription className="sr-only">Importar extrato bancário ou planilha de despesas</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Importe um extrato bancário ou planilha de despesas em formato CSV.
              O sistema irá mapear as colunas automaticamente.
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Clique para selecionar o arquivo CSV</p>
              <p className="text-xs text-muted-foreground mt-1">ou arraste aqui</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {rows.length} linhas encontradas. Mapeie as colunas:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ColSelect field="date"        label="Data"      required />
              <ColSelect field="amount"      label="Valor"     required />
              <ColSelect field="description" label="Descrição" required />
              <ColSelect field="category"    label="Categoria" />
              <ColSelect field="notes"       label="Notas" />
            </div>
            <Button size="sm" onClick={() => setStep("preview")}
              disabled={!colMap.date || !colMap.amount || !colMap.description}>
              Visualizar preview →
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview dos primeiros {preview.length} itens válidos (de {rows.length} linhas):
            </p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Data</th>
                    <th className="text-left px-3 py-2 font-medium">Descrição</th>
                    <th className="text-left px-3 py-2 font-medium">Categoria</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{r.description}</td>
                      <td className="px-3 py-2">{CAT_MAP[r.category]?.label ?? r.category}</td>
                      <td className="px-3 py-2 text-right font-medium text-destructive">{formatMoney(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Total a importar: {rows.filter(r => guessAmount(r[colMap.amount] ?? "") > 0).length} registros
            </p>
          </div>
        )}

        <DialogFooter>
          {step !== "upload" && (
            <Button variant="outline" size="sm" onClick={() => setStep(step === "preview" ? "map" : "upload")}>
              ← Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={close}>Cancelar</Button>
          {step === "preview" && (
            <Button size="sm" onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Importar {rows.filter(r => guessAmount(r[colMap.amount] ?? "") > 0).length} despesas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DespesasClient({ expenses, yearExpenses, currentMonth }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [importOpen, setImportOpen]   = useState(false)
  const [editing, setEditing] = useState<Expense | undefined>()

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth   = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth   = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel  = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])

  // Pie chart: by category this month
  const pieData = useMemo(() => {
    const byCategory: Record<string, number> = {}
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
    })
    return Object.entries(byCategory).map(([cat, val]) => ({
      name:  CAT_MAP[cat]?.label ?? cat,
      value: val,
      color: CAT_MAP[cat]?.color ?? "#94a3b8",
    })).sort((a, b) => b.value - a.value)
  }, [expenses])

  // Monthly totals for the year (for bar)
  const monthlyTotals = useMemo(() => {
    const year = parseInt(currentMonth.split("-")[0])
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, "0")}`
      const sum = yearExpenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0)
      return { month: new Date(year, i, 1).toLocaleString("pt-BR", { month: "short" }), total: sum }
    })
  }, [yearExpenses, currentMonth])

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta despesa?")) return
    const { error } = await supabase.from("expenses").delete().eq("id", id)
    if (error) { toast.error("Erro ao excluir"); return }
    toast.success("Despesa excluída")
    router.refresh()
  }

  function exportCsv() {
    downloadCsv(
      expenses.map(e => ({
        data:        e.date,
        categoria:   CAT_MAP[e.category]?.label ?? e.category,
        descricao:   e.description,
        valor:       e.amount,
        notas:       e.notes ?? "",
      })),
      `despesas-${currentMonth}.csv`,
      [
        { key: "data",      label: "Data" },
        { key: "categoria", label: "Categoria" },
        { key: "descricao", label: "Descrição" },
        { key: "valor",     label: "Valor" },
        { key: "notas",     label: "Notas" },
      ]
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Despesas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle de gastos do negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!expenses.length}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <div className="flex items-center border rounded-lg h-9">
            <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/despesas?month=${prevMonth}`)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2 capitalize min-w-36 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/despesas?month=${nextMonth}`)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button className="gap-2" onClick={() => { setEditing(undefined); setDialogOpen(true) }}>
            <Plus className="w-4 h-4" /> Nova despesa
          </Button>
        </div>
      </div>

      {/* Summary + Chart */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Total card */}
          <div className="border rounded-xl p-5 bg-card space-y-1">
            <p className="text-sm text-muted-foreground">Total no mês</p>
            <p className="text-3xl font-bold text-destructive">{formatMoney(total)}</p>
            <p className="text-xs text-muted-foreground">{expenses.length} registro{expenses.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="border rounded-xl p-4 bg-card lg:col-span-2">
              <p className="text-sm font-medium mb-2">Por categoria</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="30%" cy="50%" innerRadius={45} outerRadius={65}
                      paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Legend layout="vertical" align="right" verticalAlign="middle"
                      formatter={(val, entry) =>
                        `${val} — ${formatMoney((entry as any)?.payload?.value ?? 0)}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-xl bg-card">
          <Receipt className="w-10 h-10 opacity-30 mb-3" />
          <p className="font-medium">Nenhuma despesa neste mês</p>
          <p className="text-sm mt-1">Clique em "Nova despesa" para registrar um gasto</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium w-24">DATA</th>
                <th className="text-left px-4 py-2.5 font-medium w-40">CATEGORIA</th>
                <th className="text-left px-4 py-2.5 font-medium">DESCRIÇÃO</th>
                <th className="text-right px-4 py-2.5 font-medium w-28">VALOR</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const cat = CAT_MAP[exp.category]
                return (
                  <tr key={exp.id} className="border-b hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                      {format(parseISO(exp.date), "dd/MM")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${cat?.color}20`, color: cat?.color }}>
                        {cat?.emoji} {cat?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{exp.description}</p>
                      {exp.notes && <p className="text-xs text-muted-foreground mt-0.5">{exp.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-destructive">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditing(exp); setDialogOpen(true) }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(exp.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={3} className="px-4 py-2.5 text-sm font-medium">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-destructive tabular-nums">{formatMoney(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Monthly evolution (year) */}
      {yearExpenses.length > 0 && (
        <div className="border rounded-xl p-4 bg-card">
          <p className="text-sm font-medium mb-4">Evolução anual ({currentMonth.split("-")[0]})</p>
          <div className="flex items-end gap-1 h-24">
            {monthlyTotals.map((m, i) => {
              const max = Math.max(...monthlyTotals.map(x => x.total))
              const pct = max > 0 ? (m.total / max) * 100 : 0
              const isCurrent = i + 1 === parseInt(currentMonth.split("-")[1])
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                    <div
                      className={`w-full max-w-8 rounded-t transition-all ${isCurrent ? "bg-destructive" : "bg-destructive/30"}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={formatMoney(m.total)}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ExpenseDialog
        expense={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); router.refresh() }}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => router.refresh()}
        currentMonth={currentMonth}
      />
    </div>
  )
}
