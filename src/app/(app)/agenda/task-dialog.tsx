"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job { id: string; name: string }

interface Props {
  children: React.ReactNode
  jobs: Job[]
  open: boolean
  onOpenChange: (v: boolean) => void
  task?: AgendaEvent & { jobs: { name: string } | null }
}

const STATUS_OPTIONS = [
  { value: "working_on_it", label: "Working on it", color: "#f59e0b" },
  { value: "done",          label: "Done",          color: "#22c55e" },
  { value: "stuck",         label: "Stuck",         color: "#ef4444" },
  { value: "todo",          label: "To-Do",         color: "#94a3b8" },
]

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low",    color: "#3b82f6" },
  { value: "medium", label: "Medium", color: "#a855f7" },
  { value: "high",   label: "High",   color: "#f59e0b" },
]

export function TaskDialog({ children, jobs, open, onOpenChange, task }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!task

  const [form, setForm] = useState({
    job_id:      task?.job_id ?? "",
    title:       task?.title ?? "",
    description: task?.description ?? "",
    task_status: task?.task_status ?? "working_on_it",
    priority:    task?.priority ?? "",
    budget:      task?.budget?.toString() ?? "",
    start_date:  task?.start_date ?? "",
    event_date:  task?.event_date ?? format(new Date(), "yyyy-MM-dd"),
  })

  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("Título obrigatório"); return }
    setLoading(true)

    const payload = {
      job_id:      form.job_id || null,
      title:       form.title,
      description: form.description || null,
      type:        "milestone" as const,
      task_status: form.task_status as AgendaEvent["task_status"],
      priority:    (form.priority || null) as AgendaEvent["priority"],
      budget:      form.budget ? parseFloat(form.budget) : null,
      start_date:  form.start_date || null,
      event_date:  form.event_date,
      is_done:     form.task_status === "done",
    }

    if (isEdit) {
      const { error } = await supabase.from("agenda_events").update(payload).eq("id", task!.id)
      if (error) { toast.error("Erro ao salvar"); setLoading(false); return }
      toast.success("Tarefa atualizada!")
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("agenda_events").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar"); setLoading(false); return }
      toast.success("Tarefa criada!")
    }

    onOpenChange(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edite os campos da tarefa" : "Preencha os campos para criar uma nova tarefa"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="Nome da tarefa" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.task_status} onValueChange={v => upd("task_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority || "none"} onValueChange={v => upd("priority", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={form.start_date} onChange={e => upd("start_date", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={form.event_date} onChange={e => upd("event_date", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Budget</Label>
              <Input type="number" step="0.01" value={form.budget} onChange={e => upd("budget", e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label>Job</Label>
              <Select value={form.job_id || "none"} onValueChange={v => upd("job_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.description} onChange={e => upd("description", e.target.value)} rows={2} placeholder="Observações..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
