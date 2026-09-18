"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { calculateTotal } from "@/lib/utils"
import { roundHours } from "@/lib/csv"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { logValue, BILLING_MODE_LABELS, type BillingMode } from "@/lib/billing-mode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Timer, Square } from "lucide-react"
import { format } from "date-fns"
import type { DailyLog } from "@/lib/supabase/types"

export interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  billing_mode?: BillingMode
  currency: string
  clients: { name: string } | null
}

interface Props {
  children: React.ReactNode
  jobs: JobOption[]
  log?: DailyLog
  mode: "create" | "edit" | "duplicate"
  hourRounding?: string
  /** Pre-fills the date field on create (e.g. a day clicked in the agenda). */
  defaultDate?: string
}

const isDailyJob = (job?: JobOption) => job?.billing_mode === "daily"

export function LogDialog({ children, jobs, log, mode, hourRounding = "none", defaultDate }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isCreate = mode === "create"
  const isDuplicate = mode === "duplicate"

  const [form, setForm] = useState({
    job_id:       log?.job_id ?? (jobs[0]?.id ?? ""),
    date:         isDuplicate ? format(new Date(), "yyyy-MM-dd") : (log?.date ?? defaultDate ?? format(new Date(), "yyyy-MM-dd")),
    meetings:     log?.meetings ?? "",
    requests:     log?.requests ?? "",
    daily_rate:   log?.daily_rate ?? (jobs[0]?.daily_rate ?? 0),
    hours_worked: log?.hours_worked ?? (isDailyJob(jobs[0]) ? HOURS_PER_DAY : 0),
    hours_billed: log?.hours_billed ?? (isDailyJob(jobs[0]) ? HOURS_PER_DAY : 0),
  })

  // Live timer
  const [timerActive, setTimerActive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerActive])

  function stopTimer() {
    setTimerActive(false)
    const hours = timerSeconds / 3600
    update("hours_worked", parseFloat(hours.toFixed(2)))
  }

  function update(field: string, value: string | number) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // Auto-fill daily_rate from job if changing job
      if (field === "job_id") {
        const job = jobs.find((j) => j.id === value)
        if (job) {
          next.daily_rate = job.daily_rate
          // Daily-rate jobs default to one full day
          if (isDailyJob(job) && !next.hours_billed) {
            next.hours_billed = HOURS_PER_DAY
            if (!next.hours_worked) next.hours_worked = HOURS_PER_DAY
          }
        }
      }
      return next
    })
  }

  const selectedJob = jobs.find((j) => j.id === form.job_id)
  const isDaily     = isDailyJob(selectedJob)
  const isProject   = selectedJob?.billing_mode === "fixed"
  const daysBilled  = form.hours_billed / HOURS_PER_DAY
  // A project is billed once, at its closed price, so the hours here are time spent rather
  // than money earned.
  const totalValue  = isProject
    ? 0
    : isDaily
      ? Number((daysBilled * form.daily_rate).toFixed(2))
      : calculateTotal(form.hours_billed, selectedJob?.hourly_rate ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.job_id) { toast.error("Selecione um job"); return }
    setLoading(true)

    const roundedHours = roundHours(form.hours_worked, hourRounding)
    const payload = {
      job_id:       form.job_id,
      date:         form.date,
      meetings:     form.meetings || null,
      requests:     form.requests || null,
      daily_rate:   form.daily_rate,
      hours_worked: roundedHours,
      hours_billed: form.hours_billed,
      total_value:  totalValue,
    }

    if (isCreate || isDuplicate) {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("daily_logs").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar registro"); setLoading(false); return }
      toast.success("Registro criado!")
    } else {
      const { error } = await supabase.from("daily_logs").update(payload).eq("id", log!.id)
      if (error) { toast.error("Erro ao atualizar registro"); setLoading(false); return }
      toast.success("Registro atualizado!")
    }

    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "Novo Registro" : isDuplicate ? "Duplicar Registro" : "Editar Registro"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isCreate ? "Preencha os campos para criar um novo registro" : isDuplicate ? "Duplicar o registro selecionado" : "Edite os campos do registro"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Job *</Label>
              <Select defaultValue={form.job_id} onValueChange={(v) => update("job_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {[j.clients?.name, j.name, BILLING_MODE_LABELS[j.billing_mode ?? "hourly"]].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Reuniões</Label>
              <Textarea
                value={form.meetings}
                onChange={(e) => update("meetings", e.target.value)}
                placeholder="O que foi discutido nas reuniões..."
                rows={2}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>O que foi pedido</Label>
              <Textarea
                value={form.requests}
                onChange={(e) => update("requests", e.target.value)}
                placeholder="Tarefas e pedidos do cliente..."
                rows={2}
              />
            </div>

            {/* Timer */}
            <div className="col-span-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <div className="flex-1">
                <p className="text-sm font-medium">Timer ao vivo</p>
                <p className="text-2xl font-mono font-bold">
                  {String(Math.floor(timerSeconds / 3600)).padStart(2, "0")}:
                  {String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0")}:
                  {String(timerSeconds % 60).padStart(2, "0")}
                </p>
              </div>
              {!timerActive ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setTimerActive(true)}>
                  <Timer className="w-4 h-4" />Iniciar
                </Button>
              ) : (
                <Button type="button" size="sm" variant="destructive" onClick={stopTimer}>
                  <Square className="w-4 h-4" />Parar e usar
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Horas trabalhadas</Label>
              <Input
                type="number"
                step="0.25"
                value={form.hours_worked}
                onChange={(e) => update("hours_worked", parseFloat(e.target.value) || 0)}
              />
            </div>

            {isDaily ? (
              <div className="space-y-2">
                <Label>Dias faturados</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={daysBilled}
                  onChange={(e) => update("hours_billed", (parseFloat(e.target.value) || 0) * HOURS_PER_DAY)}
                />
                <p className="text-xs text-muted-foreground">1 dia = {HOURS_PER_DAY}h</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Horas faturadas (NF)</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={form.hours_billed}
                  onChange={(e) => update("hours_billed", parseFloat(e.target.value) || 0)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{isDaily ? "Valor/dia" : "Valor/dia (ref)"}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.daily_rate}
                onChange={(e) => update("daily_rate", parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Total calculado</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-semibold">
                {selectedJob ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: selectedJob.currency }).format(totalValue) : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {isProject
                  ? "Job por projeto: as horas ficam registradas, mas o valor vem do preço fechado."
                  : isDaily
                    ? `${daysBilled} ${daysBilled === 1 ? "dia" : "dias"} × ${form.daily_rate}/dia`
                    : `${form.hours_billed}h × ${selectedJob?.hourly_rate ?? 0}/h`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreate || isDuplicate ? "Criar Registro" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
