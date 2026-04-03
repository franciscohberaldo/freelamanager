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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { format, startOfMonth, endOfMonth } from "date-fns"
import type { DailyLog } from "@/lib/supabase/types"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
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

  const selectedJob = jobs.find((j) => j.id === jobId)

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
    if (!data || data.length === 0) { toast.warning("Nenhum registro encontrado neste período"); setLoading(false); return }
    setLogs(data)
    setStep("preview")
    setLoading(false)
  }

  const totalHours = logs.reduce((s, l) => s + l.hours_billed, 0)
  const subtotal = logs.reduce((s, l) => s + l.total_value, 0)
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
      })
      .select()
      .single()

    if (invError || !invoice) { toast.error("Erro ao criar invoice"); setLoading(false); return }

    // Insert items
    const items = logs.map((l) => ({
      invoice_id: invoice.id,
      log_id: l.id,
      date: l.date,
      hours_billed: l.hours_billed,
      rate: selectedJob!.hourly_rate,
      subtotal: l.total_value,
    }))

    const { error: itemsError } = await supabase.from("invoice_items").insert(items)
    if (itemsError) { toast.error("Erro ao salvar itens do invoice"); setLoading(false); return }

    toast.success(`Invoice #${invNumber} criado!`)
    setOpen(false)
    setStep("config")
    setLogs([])
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep("config"); setLogs([]) } }}>
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
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Selecione o job" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} {j.clients ? `· ${j.clients.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período início</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Período fim</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa/hora</span>
                <span>{formatCurrency(selectedJob?.hourly_rate ?? 0, selectedJob?.currency)}</span>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Registros ({logs.length})</p>
                {logs.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{formatDate(l.date)} · {l.hours_billed}h</span>
                    <span>{formatCurrency(l.total_value, selectedJob?.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total horas faturadas</span>
                  <span>{totalHours}h</span>
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
              <Button onClick={createInvoice} disabled={loading}>
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
