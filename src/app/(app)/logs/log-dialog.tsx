"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { calculateTotal, formatHours } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Timer, Square } from "lucide-react"
import { format } from "date-fns"
import type { DailyLog } from "@/lib/supabase/types"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  currency: string
  clients: { name: string } | null
}

interface Props {
  children: React.ReactNode
  jobs: JobOption[]
  log?: DailyLog
  mode: "create" | "edit" | "duplicate"
}

export function LogDialog({ children, jobs, log, mode }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isCreate = mode === "create"
  const isDuplicate = mode === "duplicate"

  const [form, setForm] = useState({
    job_id:       log?.job_id ?? (jobs[0]?.id ?? ""),
    date:         isDuplicate ? format(new Date(), "yyyy-MM-dd") : (log?.date ?? format(new Date(), "yyyy-MM-dd")),
    meetings:     log?.meetings ?? "",
    requests:     log?.requests ?? "",
    daily_rate:   log?.daily_rate ?? 0,
    hours_worked: log?.hours_worked ?? 0,
    hours_billed: log?.hours_billed ?? 0,
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
        if (job) next.daily_rate = job.daily_rate
      }
      return next
    })
  }

  const selectedJob = jobs.find((j) => j.id === form.job_id)
  const totalValue = calculateTotal(form.hours_billed, selectedJob?.hourly_rate ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.job_id) { toast.error("Selecione um job"); return }
    setLoading(true)

    const payload = {
      job_id:       form.job_id,
      date:         form.date,
      meetings:     form.meetings || null,
      requests:     form.requests || null,
      daily_rate:   form.daily_rate,
      hours_worked: form.hours_worked,
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
                      {j.name} {j.clients ? `· ${(j.clients as { name: string }).name}` : ""}
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

            <div className="space-y-2">
              <Label>Horas faturadas (NF)</Label>
              <Input
                type="number"
                step="0.25"
                value={form.hours_billed}
                onChange={(e) => update("hours_billed", parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor/dia (ref)</Label>
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
                {form.hours_billed}h × {selectedJob?.hourly_rate ?? 0}/h
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
