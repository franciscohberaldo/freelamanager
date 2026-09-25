"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Combobox } from "@/components/ui/combobox"
import { Loader2, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { rateOf, BILLING_MODE_LABELS, type BillingMode } from "@/lib/billing-mode"
import { buildDraft, draftIsEmpty, type ManualLine } from "@/lib/invoice-draft"
import { missingDays, logForDay } from "@/lib/job-days"
import type { DailyLog } from "@/lib/supabase/types"
import { initialNfStatus } from "@/lib/nf-status"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  contract_value?: number | null
  billing_mode?: BillingMode
  project_code?: string | null
  po_number?: string | null
  /** The job's notes: they start the invoice's notes, editable per invoice. */
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
  currency: string
  tax_rate: number
  clients: { name: string; email: string | null } | null
}

const PREVIEW_DEBOUNCE_MS = 500

/** The earliest and latest of the dates given, ignoring blanks. */
const spanOf = (dates: (string | null | undefined)[]) => {
  const ds = dates.filter((d): d is string => !!d).sort()
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null
}

/**
 * Writing an invoice with the page in view: the form on the right, and on the left the
 * PDF exactly as it will print, redrawn as the fields change. Nothing is stored until
 * "Criar invoice".
 */
export function CreateInvoiceDialog({
  children,
  jobs,
}: {
  children: React.ReactNode
  jobs: JobOption[]
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const now = new Date()
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "")
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(now), "yyyy-MM-dd"))
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(now), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState(jobs[0]?.notes ?? "")
  const [poNumber, setPoNumber] = useState(jobs[0]?.po_number ?? "")
  const [manualLines, setManualLines] = useState<ManualLine[]>([])

  const [logs, setLogs] = useState<DailyLog[]>([])
  /** log_id → invoice_number of the invoice that already billed that day. */
  const [invoicedMap, setInvoicedMap] = useState<Record<string, string>>({})
  const [loadingLogs, setLoadingLogs] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewAbort = useRef<AbortController | null>(null)

  const addLine = () => setManualLines(ls => [...ls, { description: "", job_number: "", quantity: 1, rate: 0 }])
  const updLine = (i: number, patch: Partial<ManualLine>) => setManualLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  const rmLine = (i: number) => setManualLines(ls => ls.filter((_, j) => j !== i))

  const selectedJob = jobs.find((j) => j.id === jobId)
  const isDaily     = selectedJob?.billing_mode === "daily"
  const isProject   = selectedJob?.billing_mode === "fixed"
  const toDays      = (hours: number) => Number((hours / HOURS_PER_DAY).toFixed(2))
  const qtyLabel    = (hours: number) => isDaily ? `${toDays(hours)} ${toDays(hours) === 1 ? "dia" : "dias"}` : `${hours}h`

  const freshLogs     = logs.filter(l => !invoicedMap[l.id])
  const alreadyBilled = logs.filter(l => invoicedMap[l.id])

  const draft = useMemo(
    () => buildDraft(freshLogs, selectedJob ?? { name: "" }, manualLines, periodEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, invoicedMap, selectedJob, manualLines, periodEnd],
  )
  const taxRate   = selectedJob?.tax_rate ?? 0
  const taxAmount = draft.subtotal * (taxRate / 100)
  const total     = draft.subtotal + taxAmount
  const empty     = !selectedJob || draftIsEmpty(draft, selectedJob)

  // ── the period opens on what is left to bill ────────────────────────────────────────
  // A project is invoiced whole: its period is the job's, and its days exist. Any other
  // job opens on the span of its days no invoice has taken yet, so days logged in an
  // earlier month are not hidden behind the current one.
  const [projectReady, setProjectReady] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !selectedJob) return
    let cancelled = false
    if (selectedJob.billing_mode !== "fixed") {
      ;(async () => {
        const { data: all } = await supabase.from("daily_logs").select("id, date").eq("job_id", jobId)
        const rows = all ?? []
        let billed = new Set<string>()
        if (rows.length > 0) {
          const { data: items } = await supabase.from("invoice_items").select("log_id").in("log_id", rows.map(r => r.id))
          billed = new Set((items ?? []).map(i => i.log_id as string))
        }
        if (cancelled) return
        const span = spanOf(rows.filter(r => !billed.has(r.id)).map(r => r.date as string))
        if (span) { setPeriodStart(span.start); setPeriodEnd(span.end) }
        setProjectReady(jobId)
      })()
      return () => { cancelled = true }
    }
    ;(async () => {
      const { data: all } = await supabase.from("daily_logs").select("date").eq("job_id", jobId).order("date")
      let dates = (all ?? []).map(l => l.date as string)
      if (dates.length === 0 && selectedJob.start_date && selectedJob.end_date) {
        const { data: { user } } = await supabase.auth.getUser()
        const missing = missingDays(selectedJob, [])
        if (missing.length > 0 && user) {
          const { error } = await supabase.from("daily_logs").insert(missing.map(d => logForDay(selectedJob, d, user.id)))
          if (!error) { dates = missing; toast.success(`${missing.length} ${missing.length === 1 ? "diária criada" : "diárias criadas"} para o período do job`) }
          else toast.error(`Não foi possível criar as diárias do job: ${error.message}`)
        }
      }
      if (cancelled) return
      const span = spanOf([selectedJob.start_date, selectedJob.end_date, ...dates])
      if (span) { setPeriodStart(span.start); setPeriodEnd(span.end) }
      setProjectReady(jobId)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId])

  // ── the days in the period, and which of them another invoice already took ──────────
  useEffect(() => {
    if (!open || !jobId || !periodStart || !periodEnd || projectReady !== jobId) return
    let cancelled = false
    setLoadingLogs(true)
    ;(async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("job_id", jobId)
        .gte("date", periodStart)
        .lte("date", periodEnd)
        .order("date")
      if (cancelled) return
      if (error) { toast.error(`Erro ao buscar registros: ${error.message}`); setLoadingLogs(false); return }

      const fetched = data ?? []
      const map: Record<string, string> = {}
      if (fetched.length > 0) {
        const { data: jobInvoices } = await supabase.from("invoices").select("id, invoice_number").eq("job_id", jobId)
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
      if (cancelled) return
      setInvoicedMap(map)
      setLogs(fetched)
      setLoadingLogs(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, periodStart, periodEnd, projectReady])

  // ── the page, redrawn as the fields change ──────────────────────────────────────────
  const draftKey = JSON.stringify(draft.items)
  useEffect(() => {
    if (!open || !selectedJob) return
    const timer = setTimeout(async () => {
      previewAbort.current?.abort()
      const controller = new AbortController()
      previewAbort.current = controller
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch("/api/invoices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jobId, periodStart, periodEnd, dueDate: dueDate || null, notes: notes || null,
            poNumber: poNumber || null, items: draft.items, subtotal: draft.subtotal, taxRate,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? `Erro ${res.status}`)
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
      } catch (e) {
        if ((e as Error).name !== "AbortError") setPreviewError((e as Error).message)
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, periodStart, periodEnd, dueDate, notes, poNumber, draftKey, taxRate])

  function reset() {
    previewAbort.current?.abort()
    setProjectReady(null)
    setLogs([])
    setInvoicedMap({})
    setManualLines([])
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setPreviewError(null)
    setPreviewLoading(false)
  }

  async function createInvoice() {
    if (!selectedJob) { toast.error("Selecione um job"); return }
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const year = new Date().getFullYear()

    const { data: invNumber, error: rpcError } = await supabase
      .rpc("get_next_invoice_number", { p_user_id: user!.id, p_year: year })
    if (rpcError) { toast.error("Erro ao gerar número do invoice"); setCreating(false); return }

    const { data: seqNumber, error: seqError } = await supabase.rpc("get_next_invoice_seq", { p_user_id: user!.id })
    if (seqError || !seqNumber) { toast.error("Erro ao gerar sequência da invoice"); setCreating(false); return }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        user_id: user!.id,
        job_id: jobId,
        invoice_number: invNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_hours_billed: draft.totalHours,
        subtotal: draft.subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: selectedJob.currency,
        status: "draft",
        due_date: dueDate || null,
        notes: notes || null,
        seq_number: seqNumber,
        po_number: poNumber.trim() || null,
        nf_status: initialNfStatus(selectedJob.currency),
        nf_amount_brl: selectedJob.currency === "BRL" ? total : null,
      })
      .select()
      .single()

    if (invError || !invoice) { toast.error(`Erro ao criar invoice${invError ? `: ${invError.message}` : ""}`); setCreating(false); return }

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(draft.items.map(i => ({ invoice_id: invoice.id, ...i })))
    if (itemsError) { toast.error(`Erro ao salvar itens do invoice: ${itemsError.message}`); setCreating(false); return }

    toast.success(`Invoice ${seqNumber} criado!`)
    setOpen(false)
    reset()
    router.refresh()
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNotes(selectedJob?.notes ?? ""); else reset() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[1180px] w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Gerar Invoice</DialogTitle>
          <DialogDescription>
            A prévia à esquerda é o PDF que o cliente vai receber, atualizada conforme você edita.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── the page ─────────────────────────────────────────────────────────── */}
          <div className="relative bg-muted/50 border-b lg:border-b-0 lg:border-r min-h-[320px]">
            {previewUrl && (
              <iframe
                key={previewUrl}
                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                title="Prévia do invoice"
                className="absolute inset-0 w-full h-full"
              />
            )}
            {!previewUrl && !previewLoading && !previewError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
                {selectedJob ? "Preparando a prévia…" : "Selecione um job para ver a prévia."}
              </div>
            )}
            {previewError && (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <p className="text-sm text-destructive text-center">Não foi possível gerar a prévia: {previewError}</p>
              </div>
            )}
            {previewLoading && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-background/90 border px-2 py-1 text-xs text-muted-foreground shadow-sm">
                <Loader2 className="w-3 h-3 animate-spin" /> Atualizando
              </div>
            )}
          </div>

          {/* ── the form ─────────────────────────────────────────────────────────── */}
          <div className="overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>Job *</Label>
              <Combobox
                options={jobs.map(j => ({
                  value: j.id,
                  label: [j.clients?.name, j.name, BILLING_MODE_LABELS[j.billing_mode ?? "hourly"]].filter(Boolean).join(" · "),
                }))}
                value={jobId}
                onChange={(v) => { setJobId(v); const j = jobs.find(x => x.id === v); setPoNumber(j?.po_number ?? ""); setNotes(j?.notes ?? "") }}
                placeholder="Selecione o job"
                searchPlaceholder="Buscar job…"
              />
            </div>

            {isProject && (
              <p className="text-xs text-muted-foreground -mt-2">
                Projeto fechado: o período começa como o do job e todos os dias trabalhados entram na invoice, sem valor; o preço fica na linha do projeto.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Período início</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período fim</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nº da PO</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="ex: 4702134214" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações para o invoice..." rows={2} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Linhas livres</Label>
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

            {/* ── what goes on the page ───────────────────────────────────────────── */}
            <div className="rounded-md border p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span>{selectedJob?.clients?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isProject ? "Valor do projeto" : isDaily ? "Taxa/dia" : "Taxa/hora"}
                </span>
                <span>{selectedJob ? formatCurrency(rateOf(selectedJob), selectedJob.currency) : "—"}</span>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <p className="font-medium flex items-center gap-2">
                  Diárias no período ({freshLogs.length})
                  {loadingLogs && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </p>
                {isProject && freshLogs.length > 0 && (
                  <p className="text-xs text-muted-foreground">Os dias saem listados; o valor fica na linha do projeto.</p>
                )}
                {freshLogs.map((l) => (
                  <div key={l.id} className="flex justify-between">
                    <span className="text-muted-foreground">{formatDate(l.date)} · {qtyLabel(l.hours_billed)}</span>
                    <span>{isProject ? "—" : formatCurrency(l.total_value, selectedJob?.currency)}</span>
                  </div>
                ))}
                {!loadingLogs && freshLogs.length === 0 && (
                  <div className={`rounded-md p-3 flex gap-2 ${empty ? "border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" : "bg-muted/50"}`}>
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${empty ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`} />
                    <p className={`text-xs ${empty ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {empty
                        ? <>Nenhuma diária registrada para este job nesse período, então não há o que cobrar. Adicione diárias pelo <strong>Calendário</strong> ou pelo <strong>Registro Diário</strong>, ou inclua uma linha livre.</>
                        : <>Nenhuma diária no período. {isProject ? "O invoice sai só com a linha do projeto." : "O invoice sai só com as linhas livres."}</>}
                    </p>
                  </div>
                )}
              </div>

              {alreadyBilled.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-1.5">
                  <p className="font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    {alreadyBilled.length} {alreadyBilled.length === 1 ? "diária já foi faturada" : "diárias já foram faturadas"}
                  </p>
                  {alreadyBilled.map(l => (
                    <div key={l.id} className="flex justify-between text-xs text-amber-700 dark:text-amber-400">
                      <span>{formatDate(l.date)} · {qtyLabel(l.hours_billed)}</span>
                      <span>Invoice #{invoicedMap[l.id]}</span>
                    </div>
                  ))}
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Ficaram de fora deste invoice para não cobrar em dobro.</p>
                </div>
              )}

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isProject ? "Horas gastas" : isDaily ? "Dias faturados" : "Horas faturadas"}
                  </span>
                  <span>{qtyLabel(draft.totalHours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(draft.subtotal, selectedJob?.currency)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impostos ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, selectedJob?.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(total, selectedJob?.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={createInvoice} disabled={creating || loadingLogs || empty}>
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
