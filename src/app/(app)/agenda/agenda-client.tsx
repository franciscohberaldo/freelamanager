"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatDate, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, CheckCircle2, Circle, Calendar, BarChart2 } from "lucide-react"
import { GanttChart } from "./gantt-chart"
import { format, parseISO, isPast, isToday } from "date-fns"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string
}

interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  jobs: Job[]
}

export function AgendaClient({ events, jobs }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    job_id:      "",
    title:       "",
    description: "",
    type:        "payment" as AgendaEvent["type"],
    event_date:  format(new Date(), "yyyy-MM-dd"),
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("Título obrigatório"); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("agenda_events").insert({
      user_id:     user!.id,
      job_id:      form.job_id || null,
      title:       form.title,
      description: form.description || null,
      type:        form.type,
      event_date:  form.event_date,
    })
    if (error) { toast.error("Erro ao criar evento"); setLoading(false); return }
    toast.success("Evento criado!")
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  async function toggleDone(event: AgendaEvent) {
    const { error } = await supabase
      .from("agenda_events")
      .update({ is_done: !event.is_done })
      .eq("id", event.id)
    if (error) toast.error("Erro ao atualizar")
    else router.refresh()
  }

  const pending = events.filter((e) => !e.is_done)
  const done = events.filter((e) => e.is_done)

  function getEventBadge(event: AgendaEvent) {
    if (event.is_done) return "secondary"
    if (isPast(parseISO(event.event_date)) && !isToday(parseISO(event.event_date))) return "destructive"
    if (isToday(parseISO(event.event_date))) return "warning"
    return "outline"
  }

  const EventCard = ({ event }: { event: AgendaEvent & { jobs: { name: string } | null } }) => (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <button onClick={() => toggleDone(event)} className="shrink-0">
        {event.is_done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
        }
      </button>
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: EVENT_TYPE_COLORS[event.type] }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${event.is_done ? "line-through text-muted-foreground" : ""}`}>
          {event.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.jobs?.name && `${event.jobs.name} · `}
          {EVENT_TYPE_LABELS[event.type]} · {formatDate(event.event_date, "dd/MM/yyyy")}
        </p>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
      </div>
      <Badge variant={getEventBadge(event) as "default"} className="shrink-0 text-xs">
        {formatDate(event.event_date, "dd/MM")}
      </Badge>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="list">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list">
              <Calendar className="w-4 h-4 mr-1" />Lista
            </TabsTrigger>
            <TabsTrigger value="gantt">
              <BarChart2 className="w-4 h-4 mr-1" />Gantt
            </TabsTrigger>
          </TabsList>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4" />Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Evento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="ex: Pagamento janeiro" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => update("type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={form.event_date} onChange={(e) => update("event_date", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Job (opcional)</Label>
                  <Select value={form.job_id} onValueChange={(v) => update("job_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} placeholder="Detalhes..." />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={loading}>Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ background: EVENT_TYPE_COLORS[type] }} />
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pendentes ({pending.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {pending.length === 0
                  ? <p className="text-sm text-muted-foreground">Nenhum evento pendente.</p>
                  : pending.map((ev) => <EventCard key={ev.id} event={ev} />)
                }
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Concluídos ({done.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {done.length === 0
                  ? <p className="text-sm text-muted-foreground">Nenhum evento concluído.</p>
                  : done.map((ev) => <EventCard key={ev.id} event={ev} />)
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <GanttChart events={events} jobs={jobs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
