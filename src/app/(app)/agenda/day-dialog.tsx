"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, Clock, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { LogDialog, type JobOption } from "../logs/log-dialog"
import type { AgendaEvent, DailyLog } from "@/lib/supabase/types"
import type { CalendarHold } from "./calendar-view"

export type DayLog = Pick<DailyLog, "id" | "job_id" | "date" | "hours_worked" | "hours_billed" | "total_value"> & {
  jobs: { name: string } | null
}

const HOLD_LABELS: Record<CalendarHold["type"], string> = {
  "1st_hold": "1st hold",
  "2nd_hold": "2nd hold",
  "booked":   "Booked",
}

interface Props {
  date: string | null        // yyyy-MM-dd
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  holds: CalendarHold[]
  logs: DayLog[]
  jobs: JobOption[]
  onClose: () => void
}

export function DayDialog({ date, events, holds, logs, jobs, onClose }: Props) {
  if (!date) return null
  const day = parseISO(date)

  return (
    <Dialog open={!!date} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {format(day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do dia na agenda</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Holds */}
          {holds.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reservas</p>
              {holds.map(h => (
                <div key={h.id} className="text-sm flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{HOLD_LABELS[h.type]}</span>
                  <span>{h.clients?.name ?? "—"}{h.jobs?.name ? ` · ${h.jobs.name}` : ""}</span>
                  {h.note && <span className="text-xs text-muted-foreground truncate">({h.note})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Events */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Tarefas
            </p>
            {events.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa nesse dia.</p>}
            {events.map(e => (
              <div key={e.id} className="text-sm flex items-center justify-between gap-2">
                <span className="truncate">{e.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{e.jobs?.name ?? ""}</span>
              </div>
            ))}
          </div>

          {/* Daily logs */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Diárias registradas
            </p>
            {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma diária registrada nesse dia.</p>}
            {logs.map(l => (
              <div key={l.id} className="text-sm flex items-center justify-between gap-2">
                <span className="truncate">{l.jobs?.name ?? "—"}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {l.hours_billed}h · {formatCurrency(l.total_value)}
                </span>
              </div>
            ))}
          </div>

          {/* Offer to add a daily log */}
          <div className="rounded-md border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm">Quer adicionar uma diária de um job nesse dia?</p>
            <LogDialog jobs={jobs} mode="create" defaultDate={date}>
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Adicionar diária
              </Button>
            </LogDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
