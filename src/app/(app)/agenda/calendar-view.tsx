"use client"

import { useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, parseISO, isSameMonth, isToday, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { AgendaEvent } from "@/lib/supabase/types"
import type { JobStage } from "@/lib/job-stage"
import { JobStageIcon, RunnerIcon } from "@/components/job-stage-icon"
import { JOB_STAGE_LABELS } from "@/lib/job-stage"
import { CircleDollarSign, X } from "lucide-react"
import { DayDialog, type DayLog } from "./day-dialog"
import type { JobOption } from "../logs/log-dialog"

export interface CalendarHold {
  id: string
  type: "1st_hold" | "2nd_hold" | "booked"
  start_date: string
  end_date: string
  note: string | null
  clients: { name: string } | null
  jobs: { name: string } | null
}

export interface CalendarJob {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string
  /** Work, or the first pending step after it, or done — see lib/job-stage. */
  stage?: JobStage
}

interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  holds?: CalendarHold[]
  logs?: DayLog[]
  /** Every job with dates — shown on the calendar across its start→end span. */
  jobs?: CalendarJob[]
  /** Open jobs only — offered when adding a daily log from a day. */
  pickerJobs?: JobOption[]
}

/**
 * One soft palette for everything drawn on a day. `dot` is the legend swatch, `chip` the
 * fill+ink of a chip on the grid. Blue is work that is open, grey work that is over, green
 * a day actually worked, amber and violet the two kinds of reservation.
 */
const TONE = {
  blue:   { dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60" },
  grey:   { dot: "bg-slate-400",   chip: "bg-muted text-muted-foreground hover:bg-muted/80" },
  green:  { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60" },
  amber:  { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  violet: { dot: "bg-primary",     chip: "bg-accent text-accent-foreground" },
  red:    { dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
} as const
type Tone = keyof typeof TONE

const TASK_TONE: Record<string, Tone> = {
  working_on_it: "amber",
  done:          "green",
  stuck:         "red",
  todo:          "blue",
}

const HOLD_TONE: Record<CalendarHold["type"], { tone: Tone; label: string }> = {
  "1st_hold": { tone: "amber",  label: "1st hold" },
  "2nd_hold": { tone: "grey",   label: "2nd hold" },
  "booked":   { tone: "violet", label: "Booked" },
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "blue",   label: "Job em aberto" },
  { tone: "grey",   label: "Job encerrado" },
  { tone: "green",  label: "Diária trabalhada" },
  { tone: "amber",  label: "1st hold" },
  { tone: "grey",   label: "2nd hold" },
  { tone: "violet", label: "Booked" },
]

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

/** Drag payload: what is moving and from which day it was grabbed. */
const DND_TYPE = "application/x-freela-calendar"
type DragItem = { kind: "log" | "hold" | "job" | "event"; id: string; from: string }

const DAY_MS = 86_400_000

export function CalendarView({ events, holds = [], logs = [], jobs = [], pickerJobs = [] }: Props) {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function onDragStart(e: React.DragEvent, item: DragItem) {
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(item))
    e.dataTransfer.effectAllowed = "move"
    e.stopPropagation()
  }

  async function onDrop(e: React.DragEvent, day: string) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverDay(null)
    const raw = e.dataTransfer.getData(DND_TYPE)
    if (!raw) return
    const item = JSON.parse(raw) as DragItem
    const delta = Math.round((parseISO(day).getTime() - parseISO(item.from).getTime()) / DAY_MS)
    if (delta === 0) return
    const shift = (d: string) => format(addDays(parseISO(d), delta), "yyyy-MM-dd")

    if (item.kind === "log") {
      // A day already billed on an invoice cannot wander into another period.
      const { data: billed } = await supabase
        .from("invoice_items")
        .select("invoice_id, invoices(invoice_number)")
        .eq("log_id", item.id)
        .limit(1)
      const inv = billed?.[0]?.invoices as unknown as { invoice_number: string } | null
      if (inv) { toast.warning(`Essa diária já foi faturada na invoice ${inv.invoice_number} — não dá para mover.`); return }

      const { error } = await supabase.from("daily_logs").update({ date: day }).eq("id", item.id)
      if (error) { toast.error("Erro ao mover diária"); return }
      toast.success("Diária movida", {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("daily_logs").update({ date: item.from }).eq("id", item.id)
          router.refresh()
        } },
      })
    } else if (item.kind === "hold") {
      const hold = holds.find(h => h.id === item.id)
      if (!hold) return
      const { error } = await supabase.from("availability_holds")
        .update({ start_date: shift(hold.start_date), end_date: shift(hold.end_date) })
        .eq("id", item.id)
      if (error) { toast.error("Erro ao mover reserva"); return }
      toast.success("Reserva movida", {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("availability_holds")
            .update({ start_date: hold.start_date, end_date: hold.end_date })
            .eq("id", item.id)
          router.refresh()
        } },
      })
    } else if (item.kind === "event") {
      const { error } = await supabase.from("agenda_events").update({ event_date: day }).eq("id", item.id)
      if (error) { toast.error("Erro ao mover tarefa"); return }
      toast.success("Tarefa movida", {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("agenda_events").update({ event_date: item.from }).eq("id", item.id)
          router.refresh()
        } },
      })
    } else {
      const job = jobs.find(j => j.id === item.id)
      if (!job?.start_date) return
      const { error } = await supabase.from("jobs")
        .update({ start_date: shift(job.start_date), end_date: job.end_date ? shift(job.end_date) : null })
        .eq("id", item.id)
      if (error) { toast.error("Erro ao mover job"); return }
      toast.success("Job movido", {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("jobs")
            .update({ start_date: job.start_date, end_date: job.end_date })
            .eq("id", item.id)
          router.refresh()
        } },
      })
    }
    router.refresh()
  }

  // Holds active on a given day (booked wins over 1st hold over 2nd hold)
  const holdsForDay = (key: string) =>
    holds
      .filter(h => h.start_date <= key && h.end_date >= key)
      .sort((a, b) => ["booked", "1st_hold", "2nd_hold"].indexOf(a.type) - ["booked", "1st_hold", "2nd_hold"].indexOf(b.type))

  // Jobs whose start→end span covers the day (a missing end reads as a single day)
  const jobsForDay = (key: string) =>
    jobs.filter(j => {
      if (!j.start_date) return false
      const end = j.end_date ?? j.start_date
      return j.start_date <= key && key <= end
    })

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    const result: Date[] = []
    let cur = start
    while (cur <= end) { result.push(cur); cur = addDays(cur, 1) }
    return result
  }, [month])

  const eventsByDate = useMemo(() => {
    const map: Record<string, (AgendaEvent & { jobs: { name: string } | null })[]> = {}
    events.forEach(e => {
      const k = e.event_date.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(e)
    })
    return map
  }, [events])

  const logsByDate = useMemo(() => {
    const map: Record<string, DayLog[]> = {}
    logs.forEach(l => {
      const k = l.date.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(l)
    })
    return map
  }, [logs])

  const chip = (tone: Tone, extra?: string) =>
    cn("block text-xs leading-5 px-2 py-0.5 rounded-md truncate transition-colors", TONE[tone].chip, extra)

  /** The side handle that starts a drag; the chip itself stays clickable. */
  const grip = (item: DragItem) => (
    <span
      draggable
      onDragStart={e => onDragStart(e, item)}
      onDragEnd={() => setDragOverDay(null)}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      title="Arrastar para outro dia"
      className="cursor-grab active:cursor-grabbing shrink-0 opacity-40 hover:opacity-100 -ml-1 -my-0.5 py-0.5"
    >
      <GripVertical className="w-3 h-3" />
    </span>
  )

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      {/* Month */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-4">
        <button
          type="button"
          onClick={() => setMonth(m => subMonths(m, 1))}
          aria-label="Mês anterior"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</p>
          <p className="text-sm text-muted-foreground">Visão mensal</p>
        </div>
        <button
          type="button"
          onClick={() => setMonth(m => addMonths(m, 1))}
          aria-label="Próximo mês"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-2.5 border-t border-b text-sm text-foreground/80">
        {LEGEND.map(l => (
          <span key={l.label} className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", TONE[l.tone].dot)} /> {l.label}
          </span>
        ))}
        <span className="hidden sm:inline-block w-px h-4 bg-border" aria-hidden />
        <span className="flex items-center gap-1.5"><RunnerIcon className="w-3.5 h-3.5" /> Em andamento</span>
        <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"><X className="w-3.5 h-3.5" strokeWidth={2.5} /><span className="text-foreground/80">Pendência (invoice, NF, DAS, recebimento)</span></span>
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CircleDollarSign className="w-3.5 h-3.5" /><span className="text-foreground/80">Recebido</span></span>
        <span className="flex items-center gap-1.5 text-muted-foreground"><GripVertical className="w-3.5 h-3.5" /><span className="text-foreground/80">Arraste pela alça para mover de dia</span></span>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 border-t">
        {days.map((day, i) => {
          const key      = format(day, "yyyy-MM-dd")
          const evs      = eventsByDate[key] ?? []
          const dayLogs  = logsByDate[key] ?? []
          const inMonth  = isSameMonth(day, month)
          const today    = isToday(day)
          const dayHolds = holdsForDay(key)
          const topHold  = dayHolds[0]
          const dayJobs  = jobsForDay(key)
          return (
            <div
              key={i}
              onClick={() => setSelectedDay(key)}
              onDragOver={e => {
                if (e.dataTransfer.types.includes(DND_TYPE)) { e.preventDefault(); setDragOverDay(key) }
              }}
              onDragLeave={() => setDragOverDay(d => (d === key ? null : d))}
              onDrop={e => onDrop(e, key)}
              className={cn(
                "min-h-[140px] p-2 border-b cursor-pointer transition-colors",
                i % 7 !== 0 && "border-l",
                dragOverDay === key ? "bg-accent ring-2 ring-inset ring-primary" : today ? "bg-accent/40" : "hover:bg-muted/40",
              )}
              title={dayHolds.map(h => `${HOLD_TONE[h.type].label}: ${h.clients?.name ?? "—"}${h.jobs?.name ? ` · ${h.jobs.name}` : ""}`).join("\n") || undefined}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn(
                  "text-sm w-7 h-7 flex items-center justify-center rounded-full tabular",
                  today ? "bg-primary text-primary-foreground font-semibold" : inMonth ? "text-foreground font-medium" : "text-muted-foreground/50",
                )}>
                  {format(day, "d")}
                </span>
                {topHold && (
                  <span className={chip(HOLD_TONE[topHold.type].tone, "max-w-[65%] text-[11px] flex items-center gap-0.5")}>
                    {grip({ kind: "hold", id: topHold.id, from: key })}
                    <span className="truncate">{topHold.clients?.name ?? HOLD_TONE[topHold.type].label}</span>
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayJobs.slice(0, 2).map(j => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    onClick={e => e.stopPropagation()}
                    title={`${j.name} — ${j.start_date}${j.end_date && j.end_date !== j.start_date ? ` a ${j.end_date}` : ""}${j.status === "completed" ? " (encerrado)" : ""}`}
                    className={cn(chip(j.status === "completed" ? "grey" : "blue"), "flex items-center gap-1.5")}
                  >
                    {grip({ kind: "job", id: j.id, from: key })}
                    {j.stage && <JobStageIcon stage={j.stage} withLabel={false} />}
                    <span className="truncate">{j.name}</span>
                    {j.stage && j.stage !== "work" && j.stage !== "done" && (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 shrink-0">
                        {JOB_STAGE_LABELS[j.stage]}
                      </span>
                    )}
                  </Link>
                ))}
                {dayJobs.length > 2 && (
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 px-1 font-medium">
                    +{dayJobs.length - 2} job{dayJobs.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
                {evs.slice(0, 3).map(e => (
                  <div key={e.id} className={cn(chip(TASK_TONE[e.task_status] ?? "blue"), "flex items-center gap-1")} title={e.title}>
                    {grip({ kind: "event", id: e.id, from: key })}
                    <span className="truncate">
                      {e.title}{e.jobs?.name ? <span className="opacity-70"> • {e.jobs.name}</span> : null}
                    </span>
                  </div>
                ))}
                {evs.length > 3 && (
                  <p className="text-[11px] text-muted-foreground px-1">+{evs.length - 3} mais</p>
                )}
                {dayLogs.slice(0, 2).map(l => (
                  <Link
                    key={l.id}
                    href={`/jobs/${l.job_id}`}
                    onClick={e => e.stopPropagation()}
                    title={`${l.jobs?.name ?? "Diária"} — ${l.hours_billed}h faturadas`}
                    className={cn(chip("green"), "flex items-center gap-1")}
                  >
                    {grip({ kind: "log", id: l.id, from: key })}
                    <span className="truncate">{l.jobs?.name ?? "Diária"}</span>
                  </Link>
                ))}
                {dayLogs.length > 2 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 px-1 font-medium">
                    +{dayLogs.length - 2} diária{dayLogs.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <DayDialog
        date={selectedDay}
        events={selectedDay ? (eventsByDate[selectedDay] ?? []) : []}
        holds={selectedDay ? holdsForDay(selectedDay) : []}
        logs={selectedDay ? (logsByDate[selectedDay] ?? []) : []}
        jobs={pickerJobs}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  )
}
