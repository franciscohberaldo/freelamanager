"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Combobox } from "@/components/ui/combobox"
import { Loader2, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { rateOf, BILLING_MODE_LABELS, type BillingMode } from "@/lib/billing-mode"
import type { DailyLog } from "@/lib/supabase/types"
import { initialNfStatus } from "@/lib/nf-status"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  billing_mode?: BillingMode
  project_code?: string | null
  po_number?: string | null
  currency: string
  tax_rate: number
  clients: { name: string; email: string | null } | null
}

export function CreateInvoiceDialog({
  children,
  jobs,
}: {
  children: React.ReactNode
  jobs: JobOption[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"config" | "preview">("config")
  const router = useRouter()
  const supabase = createClient()

  const now = new Date()
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "")
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"))
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [logs, setLogs] = useState<DailyLog[]>([])
  /** log_id → invoice_number of the invoice that already billed that day. */
  const [invoicedMap, setInvoicedMap] = useState<Record<string, string>>({})
  const [poNumber, setPoNumber] = useState(jobs[0]?.po_number ?? "")
  const [emptyWarning, setEmptyWarning] = useState(false)
  type ManualLine = { description: string; job_number: string; quantity: number; rate: number }
  const [manualLines, setManualLines] = useState<ManualLine[]>([])
  const addLine = () => setManualLines(ls => [...ls, { description: "", job_number: "", quantity: 1, rate: 0 }])
  const updLine = (i: number, patch: Partial<ManualLine>) => setManualLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  const rmLine = (i: number) => setManualLines(ls => ls.filter((_, j) => j !== i))
  const manualSubtotal = manualLines.reduce((s, l) => s + l.quantity * l.rate, 0)

  const selectedJob = jobs.find((j) => j.id === jobId)
  const isDaily     = selectedJob?.billing_mode === "daily"
  const isProject   = selectedJob?.billing_mode === "fixed"
  const projectValue = rateOf(selectedJob ?? {})
  const toDays      = (hours: number) => Number((hours / HOURS_PER_DAY).toFixed(2))
  const qtyLabel    = (hours: number) => isDaily && !isProject ? `${toDays(hours)} ${toDays(hours) === 1 ? "dia" : "dias"}` : `${hours}h`

  async function fetchLogs() {
    if (!jobId) { toast.error("Selecione um job"); return }
    setLoading(true)
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("job_id", jobId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date")

    if (error) { toast.error("Erro ao buscar registros"); setLoading(false); return }
    if ((!data || data.length === 0) && manualLines.length === 0 && !isProject) {
      setEmptyWarning(true)
      toast.warning("Nenhum registro no período e nenhuma linha livre")
      setLoading(false)
      return
    }
    setEmptyWarning(false)

    // Cross-check: which of these days were already billed on another invoice of this job
    const fetched = data ?? []
    const map: Record<string, string> = {}
    if (fetched.length > 0) {
      const { data: jobInvoices } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .eq("job_id", jobId)
      const invoiceIds = (jobInvoices ?? []).map(i => i.id)
      if (invoiceIds.length > 0) {
        const { data: items } = await supabase
          .from("invoice_items")
          .select("log_id, invoice_id")
          .in("log_id", fetched.map(l => l.id))
          .in("invoice_id", invoiceIds)
        ;(items ?? []).forEach(it => {
          if (!it.log_id) return
          const inv = (jobInvoices ?? []).find(i => i.id === it.invoice_id)
          if (inv) map[it.log_id] = inv.invoice_number
        })
      }
    }
    setInvoicedMap(map)
    setLogs(fetched)
    setStep("preview")
    setLoading(false)
  }

  const freshLogs    = logs.filter(l => !invoicedMap[l.id])
  const alreadyBilled = logs.filter(l => invoicedMap[l.id])

  const totalHours = freshLogs.reduce((s, l) => s + l.hours_billed, 0)
  const subtotal = (isProject ? projectValue : freshLogs.reduce((s, l) => s + l.total_value, 0)) + manualSubtotal
  const taxRate = selectedJob?.tax_rate ?? 0
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  async function createInvoice() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const year = new Date().getFullYear()

    // Get next invoice number via RPC
    const { data: invNumber, error: rpcError } = await supabase
      .rpc("get_next_invoice_number", { p_user_id: user!.id, p_year: year })

    if (rpcError) { toast.error("Erro ao gerar número do invoice"); setLoading(false); return }

    const { data: seqNumber, error: seqError } = await supabase.rpc("get_next_invoice_seq", { p_user_id: user!.id })
    if (seqError || !seqNumber) { toast.error("Erro ao gerar sequência da invoice"); setLoading(false); return }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        user_id: user!.id,
        job_id: jobId,
        invoice_number: invNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_hours_billed: totalHours,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: selectedJob!.currency,
        status: "draft",
        due_date: dueDate || null,
        notes: notes || null,
        seq_number: seqNumber,
        po_number: poNumber.trim() || null,
        nf_status: initialNfStatus(selectedJob!.currency),
        nf_amount_brl: selectedJob!.currency === "BRL" ? total : null,
      })
      .select()
      .single()

    if (invError || !invoice) { toast.error("Erro ao criar invoice"); setLoading(false); return }

    // A project is one line at its closed price; the logs behind it are time, not money.
    const items = isProject ? [{
      invoice_id: invoice.id,
      log_id: null,
      date: periodEnd,
      description: selectedJob!.name,
      hours_billed: totalHours,
      quantity: 1,
      unit: "project" as const,
      rate: projectValue,
      subtotal: projectValue,
    }] : freshLogs.map((l) => ({
      invoice_id: invoice.id,
      log_id: l.id,
      date: l.date,
      hours_billed: l.hours_billed,
      quantity: isDaily ? toDays(l.hours_billed) : l.hours_billed,
      unit: isDaily ? "day" : "hour",
      rate: isDaily ? selectedJob!.daily_rate : selectedJob!.hourly_rate,
      subtotal: l.total_value,
    }))

    const manualItems = manualLines
      .filter(l => l.description.trim() && l.quantity > 0)
      .map(l => ({
        invoice_id: invoice.id, log_id: null, date: periodEnd,
        description: l.description.trim(), job_number: l.job_number.trim() || null,
        hours_billed: 0, quantity: l.quantity, unit: "hour" as const,
        rate: l.rate, subtotal: Number((l.quantity * l.rate).toFixed(2)), is_manual: true,
      }))

    const { error: itemsError } = await supabase.from("invoice_items").insert([...items, ...manualItems])
    if (itemsError) { toast.error("Erro ao salvar itens do invoice"); setLoading(false); return }

    toast.success(`Invoice ${seqNumber} criado!`)
    setOpen(false)
    setStep("config")
    setLogs([])
    setInvoicedMap({})
    setManualLines([])
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep("config"); setLogs([]); setInvoicedMap({}) } }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "config" ? "Gerar Invoice" : `Preview — ${selectedJob?.name}`}
          </DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job *</Label>
              <Combobox
                options={jobs.map(j => ({
                  value: j.id,
                  label: [j.clients?.name, j.name, BILLING_MODE_LABELS[j.billing_mode ?? "hourly"]].filter(Boolean).join(" · "),
                }))}
                value={jobId}
                onChange={(v) => { setJobId(v); setEmptyWarning(false); const j = jobs.find(x => x.id === v); setPoNumber(j?.po_number ?? "") }}
                placeholder="Selecione o job"
                searchPlaceholder="Buscar job…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período início</Label>
                <Input type="date" value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setEmptyWarning(false) }} />
              </div>
              <div className="space-y-2">
                <Label>Período fim</Label>
                <Input type="date" value={periodEnd} onChange={(e) => { setPeriodEnd(e.target.value); setEmptyWarning(false) }} />
              </div>
              <div className="space-y-2">
                <Label>Data de vencimento</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações para o invoice..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Nº da PO (opcional)</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="ex: 4702134214" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Linhas livres (opcional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Linha</Button>
              </div>
              {manualLines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5"><Input value={l.description} onChange={e => updLine(i, { description: e.target.value })} placeholder="Descrição" /></div>
                  <div className="col-span-3"><Input value={l.job_number} onChange={e => updLine(i, { job_number: e.target.value })} placeholder="Job number" /></div>
                  <div className="col-span-1"><Input type="number" min={0} step="0.5" value={l.quantity} onChange={e => updLine(i, { quantity: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="col-span-2"><Input type="number" min={0} step="0.01" value={l.rate} onChange={e => updLine(i, { rate: parseFloat(e.target.value) || 0 })} placeholder="Valor" /></div>
                  <div className="col-span-1"><Button type="button" variant="ghost" size="sm" onClick={() => rmLine(i)}>×</Button></div>
                </div>
              ))}
            </div>

            {emptyWarning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Nenhuma diária registrada para este job nesse período — por isso o invoice não é gerado.
                  Adicione diárias clicando no dia no <strong>Calendário</strong> ou em{" "}
                  <strong>Tracking Diário</strong>, ou inclua uma <strong>linha livre</strong> abaixo.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={fetchLogs} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Ver Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Período</span>
                <span>{formatDate(periodStart)} – {formatDate(periodEnd)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span>{selectedJob?.clients?.name ?? "—"}</span>
              </div>
              {selectedJob?.project_code && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Projeto</span>
                  <span>{selectedJob.project_code}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isProject ? "Valor do projeto" : isDaily ? "Taxa/dia" : "Taxa/hora"}
                </span>
                <span>
                  {formatCurrency(
                    isProject ? projectValue : isDaily ? (selectedJob?.daily_rate ?? 0) : (selectedJob?.hourly_rate ?? 0),
                    selectedJob?.currency,
                  )}
                </span>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">
                  Registros ({freshLogs.length})
                  {isProject && (
                    <span className="ml-1.5 font-normal text-xs text-muted-foreground">
                      tempo gasto; a invoice sai com uma linha só
                    </span>
                  )}
                </p>
                {freshLogs.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{formatDate(l.date)} · {qtyLabel(l.hours_billed)}</span>
                    <span>{isProject ? "—" : formatCurrency(l.total_value, selectedJob?.currency)}</span>
                  </div>
                ))}
              </div>

              {alreadyBilled.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1.5">
                  <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    {alreadyBilled.length} {alreadyBilled.length === 1 ? "diária já foi faturada" : "diárias já foram faturadas"} para este job
                  </p>
                  {alreadyBilled.map(l => (
                    <div key={l.id} className="flex justify-between text-xs text-amber-700 dark:text-amber-400">
                      <span>{formatDate(l.date)} · {qtyLabel(l.hours_billed)}</span>
                      <span>Invoice #{invoicedMap[l.id]}</span>
                    </div>
                  ))}
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                    Essas diárias ficaram de fora deste invoice para não cobrar em dobro.
                  </p>
                </div>
              )}

              {manualLines.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Linhas livres ({manualLines.length})</p>
                  {manualLines.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{l.description}{l.job_number ? ` · ${l.job_number}` : ""} · {l.quantity} × {formatCurrency(l.rate, selectedJob?.currency)}</span>
                      <span>{formatCurrency(l.quantity * l.rate, selectedJob?.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isProject ? "Total de horas gastas" : isDaily ? "Total dias faturados" : "Total horas faturadas"}
                  </span>
                  <span>{qtyLabel(totalHours)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal, selectedJob?.currency)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impostos ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, selectedJob?.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total, selectedJob?.currency)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("config")}>Voltar</Button>
              <Button onClick={createInvoice} disabled={loading || (!isProject && freshLogs.length === 0 && manualLines.filter(l => l.description.trim() && l.quantity > 0).length === 0)}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Invoice
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
