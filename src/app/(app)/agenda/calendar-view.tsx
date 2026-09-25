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

/** A day inside a job's span that has no diária: the bar goes a faint, striped green. */
const OFF_DAY_STYLE: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklab, currentColor 12%, transparent) 4px 8px)",
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

/** Drag payload: what is moving (or which edge is stretching) and from which day it was grabbed. */
const DND_TYPE = "application/x-freela-calendar"
type DragItem = {
  kind: "log" | "log-extend" | "hold" | "job" | "event" | "job-start" | "job-end" | "hold-start" | "hold-end"
  id: string
  from: string
}

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

    if (item.kind === "job-start" || item.kind === "job-end") {
      const job = jobs.find(j => j.id === item.id)
      if (!job?.start_date) return
      if (item.kind === "job-start" && job.end_date && day > job.end_date) {
        toast.warning("O início não pode ficar depois do fim do job"); return
      }
      if (item.kind === "job-end" && day < job.start_date) {
        toast.warning("O fim não pode ficar antes do início do job"); return
      }
      const patch = item.kind === "job-start" ? { start_date: day } : { end_date: day }
      const { error } = await supabase.from("jobs").update(patch).eq("id", item.id)
      if (error) { toast.error("Erro ao ajustar período do job"); return }
      toast.success("Período do job atualizado", {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("jobs")
            .update({ start_date: job.start_date, end_date: job.end_date })
            .eq("id", item.id)
          router.refresh()
        } },
      })
      router.refresh()
      return
    }

    if (item.kind === "hold-start" || item.kind === "hold-end") {
      const hold = holds.find(h => h.id === item.id)
      if (!hold) return
      if (item.kind === "hold-start" && day > hold.end_date) {
        toast.warning("O início não pode ficar depois do fim da reserva"); return
      }
      if (item.kind === "hold-end" && day < hold.start_date) {
        toast.warning("O fim não pode ficar antes do início da reserva"); return
      }
      const patch = item.kind === "hold-start" ? { start_date: day } : { end_date: day }
      const { error } = await supabase.from("availability_holds").update(patch).eq("id", item.id)
      if (error) { toast.error("Erro ao ajustar período da reserva"); return }
      toast.success("Período da reserva atualizado", {
        duration: 10000,
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("availability_holds")
            .update({ start_date: hold.start_date, end_date: hold.end_date })
            .eq("id", item.id)
          router.refresh()
        } },
      })
      router.refresh()
      return
    }

    if (item.kind === "log-extend") {
      // Dragging a diária's arrow to another day marks every weekday in between as
      // worked too, copying hours/rate from the original. Weekends are skipped (work
      // on a weekend? drag the chip there by hand). Days that already have a log for
      // this job are skipped as well.
      const log = logs.find(l => l.id === item.id)
      if (!log) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error("Sessão expirada — entre de novo"); return }
      const from = parseISO(log.date.slice(0, 10))
      const to = parseISO(day)
      const step = to > from ? 1 : -1
      const taken = new Set(logs.filter(l => l.job_id === log.job_id).map(l => l.date.slice(0, 10)))
      const rows = []
      for (let cur = addDays(from, step); step > 0 ? cur <= to : cur >= to; cur = addDays(cur, step)) {
        if (cur.getDay() === 0 || cur.getDay() === 6) continue // fins de semana ficam de fora
        const k = format(cur, "yyyy-MM-dd")
        if (taken.has(k)) continue
        taken.add(k)
        rows.push({
          user_id: user.id, job_id: log.job_id, date: k,
          daily_rate: log.daily_rate, hours_worked: log.hours_worked,
          hours_billed: log.hours_billed, total_value: log.total_value,
        })
      }
      if (rows.length === 0) { toast.info("Nenhum dia útil novo nesse intervalo — fins de semana ficam de fora"); return }
      const { data: created, error } = await supabase.from("daily_logs").insert(rows).select("id")
      if (error) { toast.error("Erro ao marcar os dias trabalhados"); return }
      toast.success(rows.length === 1 ? "1 diária adicionada" : `${rows.length} diárias adicionadas`, {
        duration: 10000, // tempo para alcançar o Desfazer
        action: { label: "Desfazer", onClick: async () => {
          await supabase.from("daily_logs").delete().in("id", (created ?? []).map(r => r.id))
          router.refresh()
        } },
      })
      router.refresh()
      return
    }

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

  /** The × on a diária chip. A billed day cannot be deleted; undo re-creates the row. */
  async function deleteLog(l: DayLog) {
    const { data: billed } = await supabase
      .from("invoice_items")
      .select("invoice_id, invoices(invoice_number)")
      .eq("log_id", l.id)
      .limit(1)
    const inv = billed?.[0]?.invoices as unknown as { invoice_number: string } | null
    if (inv) { toast.warning(`Essa diária já foi faturada na invoice ${inv.invoice_number} — não dá para apagar.`); return }

    const { error } = await supabase.from("daily_logs").delete().eq("id", l.id)
    if (error) { toast.error("Erro ao apagar diária"); return }
    toast.success("Diária apagada", {
      duration: 10000, // tempo para alcançar o Desfazer
      action: { label: "Desfazer", onClick: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from("daily_logs").insert({
          user_id: user.id, job_id: l.job_id, date: l.date.slice(0, 10),
          daily_rate: l.daily_rate, hours_worked: l.hours_worked,
          hours_billed: l.hours_billed, total_value: l.total_value,
        })
        router.refresh()
      } },
    })
    router.refresh()
  }

  // A hold reserves time still to come: past days don't show it, so a hold that began
  // before today is drawn from today on.
  const todayKey = format(new Date(), "yyyy-MM-dd")
  const holdVisibleStart = (h: CalendarHold) => (h.start_date > todayKey ? h.start_date : todayKey)

  // Holds active on a given day (booked wins over 1st hold over 2nd hold)
  const holdsForDay = (key: string) =>
    holds
      .filter(h => key >= todayKey && h.start_date <= key && h.end_date >= key)
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

  // First/last visible day — spans that start before or end after the window still
  // offer their stretch edge on the window's boundary day.
  const firstKey = format(days[0], "yyyy-MM-dd")
  const lastKey = format(days[days.length - 1], "yyyy-MM-dd")

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

  // A closed job's day shows the grey job bar with its post-delivery stage instead
  // of the green diária chip — the stage is what matters once the work is over.
  // Jobs whose days are tracked as diárias: on those, a past day in the span with no
  // diária was a day off. Jobs with no diárias at all are drawn as a plain span.
  const jobsWithLogs = useMemo(() => new Set(logs.map(l => l.job_id)), [logs])

  const completedJobIds = useMemo(
    () => new Set(jobs.filter(j => j.status === "completed").map(j => j.id)),
    [jobs],
  )

  // Every chip is one fixed height, so a span's unlabelled middle days read as the same
  // bar as its labelled first day rather than collapsing to a sliver.
  const chip = (tone: Tone, extra?: string) =>
    cn("block h-6 text-xs leading-5 px-2 py-0.5 rounded-md truncate transition-colors", TONE[tone].chip, extra)

  /** Visual hint that the chip can be dragged — the whole chip is the drag source. */
  const grip = <GripVertical className="w-3 h-3 shrink-0 opacity-40 -ml-1" />

  /** The stretchable edge of a job/hold chip, offered on the span's first/last day. */
  const edge = (item: DragItem, side: "left" | "right") => (
    <span
      draggable
      onDragStart={e => onDragStart(e, item)}
      onDragEnd={() => setDragOverDay(null)}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      title={side === "left" ? "Arrastar para mudar o início" : "Arrastar para mudar o fim"}
      className={cn(
        "cursor-ew-resize shrink-0 self-stretch w-1.5 my-0.5 rounded-full bg-current opacity-30 hover:opacity-70",
        side === "left" ? "-ml-1" : "-mr-1",
      )}
    />
  )

  /** Arrow handle on a diária chip: drag it to another day to mark the days in between as worked too. */
  const arrowEdge = (item: DragItem, side: "left" | "right") => (
    <span
      draggable
      onDragStart={e => onDragStart(e, item)}
      onDragEnd={() => setDragOverDay(null)}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      title={side === "left"
        ? "Arrastar para marcar os dias úteis anteriores como trabalhados"
        : "Arrastar para marcar os dias úteis seguintes como trabalhados"}
      className={cn(
        "cursor-ew-resize shrink-0 self-stretch flex items-center opacity-40 hover:opacity-90",
        side === "left" ? "-ml-1" : "-mr-1 ml-auto",
      )}
    >
      {side === "left" ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </span>
  )

  /** Chip-level drag props: grab anywhere on the chip to move it. */
  const dragProps = (item: DragItem) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => onDragStart(e, item),
    onDragEnd: () => setDragOverDay(null),
  })

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
        <span className="flex items-center gap-2">
          <span className="w-4 h-2.5 rounded-sm border border-emerald-600/20 bg-emerald-50/50 text-emerald-700/60 dark:bg-emerald-950/20 dark:text-emerald-300/60" style={OFF_DAY_STYLE} /> Dia sem diária
        </span>
        <span className="hidden sm:inline-block w-px h-4 bg-border" aria-hidden />
        <span className="flex items-center gap-1.5"><RunnerIcon className="w-3.5 h-3.5" /> Em andamento</span>
        <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"><X className="w-3.5 h-3.5" strokeWidth={2.5} /><span className="text-foreground/80">Pendência (invoice, recebimento, NF, DAS)</span></span>
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CircleDollarSign className="w-3.5 h-3.5" /><span className="text-foreground/80">Recebido</span></span>
        <span className="flex items-center gap-1.5 text-muted-foreground"><GripVertical className="w-3.5 h-3.5" /><span className="text-foreground/80">Arraste o chip para mover · puxe a borda do job/reserva para esticar · puxe a seta da diária para marcar mais dias úteis</span></span>
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
          // One entry per job per day, all in the job's lane so its days read as one
          // continuous line: an open job with a diária shows the green piece, a closed
          // job the grey bar with its stage (its diárias hidden), and a past day with no
          // diária the striped piece. Diárias of jobs not drawn here fall to the end.
          const dayJobs  = jobsForDay(key)
          const visibleLogs = dayLogs.filter(l => !completedJobIds.has(l.job_id) && !dayJobs.some(j => j.id === l.job_id))
          const prevKey  = format(addDays(day, -1), "yyyy-MM-dd")
          const nextKey  = format(addDays(day, 1), "yyyy-MM-dd")
          const loggedOn = (jobId: string, k: string) => (logsByDate[k] ?? []).some(l => l.job_id === jobId)
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
              </div>

              <div className="space-y-1">
                {dayHolds.slice(0, 2).map(h => {
                  // Holds draw as continuous bars too, same spanning rules as jobs.
                  const visibleStart   = holdVisibleStart(h)
                  const continuesLeft  = visibleStart < key
                  const continuesRight = h.end_date > key
                  const showLabel = !continuesLeft || day.getDay() === 0
                  const showStartEdge = key === visibleStart || (key === firstKey && visibleStart < firstKey)
                  const showEndEdge   = key === h.end_date || (key === lastKey && h.end_date > lastKey)
                  return (
                    <div
                      key={h.id}
                      {...dragProps({ kind: "hold", id: h.id, from: key })}
                      title={`${HOLD_TONE[h.type].label}: ${h.clients?.name ?? "—"}${h.jobs?.name ? ` · ${h.jobs.name}` : ""} — ${h.start_date} a ${h.end_date}`}
                      className={cn(
                        chip(HOLD_TONE[h.type].tone),
                        "flex items-center gap-1.5 cursor-grab active:cursor-grabbing relative z-10",
                        continuesLeft  && "rounded-l-none -ml-[9px]",
                        continuesRight && "rounded-r-none -mr-[9px]",
                      )}
                    >
                      {showStartEdge && edge({ kind: "hold-start", id: h.id, from: key }, "left")}
                      {showLabel ? (
                        <>
                          {grip}
                          <span className="truncate">{h.clients?.name ?? HOLD_TONE[h.type].label}</span>
                          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide opacity-60 shrink-0">
                            {HOLD_TONE[h.type].label}
                          </span>
                        </>
                      ) : (
                        <span className="flex-1" aria-hidden />
                      )}
                      {showEndEdge && edge({ kind: "hold-end", id: h.id, from: key }, "right")}
                    </div>
                  )
                })}
                {dayHolds.length > 2 && (
                  <p className="text-[11px] text-muted-foreground px-1 font-medium">
                    +{dayHolds.length - 2} reserva{dayHolds.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
                {dayJobs.slice(0, 2).map(j => {
                  // Jobs draw as one continuous bar across their span: each day's piece
                  // bleeds over the cell padding and border to meet its neighbours, and
                  // only the first piece of the week carries the name.
                  const spanEnd = j.end_date ?? j.start_date!
                  const continuesLeft  = j.start_date! < key
                  const continuesRight = spanEnd > key
                  const showLabel = !continuesLeft || day.getDay() === 0
                  const showStartEdge = key === j.start_date || (key === firstKey && j.start_date! < firstKey)
                  const showEndEdge   = key === spanEnd || (key === lastKey && spanEnd > lastKey)
                  const offDay = jobsWithLogs.has(j.id) && key <= todayKey && !dayLogs.some(l => l.job_id === j.id)
                  const log = completedJobIds.has(j.id) ? undefined : dayLogs.find(l => l.job_id === j.id)
                  if (log) {
                    // A run of worked days is one green stretch: name and arrows on its ends.
                    const runStart = !continuesLeft || !loggedOn(j.id, prevKey)
                    const runEnd   = !continuesRight || !loggedOn(j.id, nextKey)
                    return (
                      <Link
                        key={log.id}
                        href={`/jobs/${log.job_id}`}
                        onClick={e => e.stopPropagation()}
                        {...dragProps({ kind: "log", id: log.id, from: key })}
                        title={`${log.jobs?.name ?? "Diária"} — ${log.hours_billed}h faturadas`}
                        className={cn(
                          chip("green"),
                          "flex items-center gap-1 cursor-grab active:cursor-grabbing relative z-10",
                          continuesLeft  && "rounded-l-none -ml-[9px]",
                          continuesRight && "rounded-r-none -mr-[9px]",
                        )}
                      >
                        {runStart && arrowEdge({ kind: "log-extend", id: log.id, from: key }, "left")}
                        {(runStart || day.getDay() === 0) ? (
                          <>
                            {grip}
                            <span className="truncate">{log.jobs?.name ?? j.name}</span>
                          </>
                        ) : (
                          <span className="flex-1" aria-hidden />
                        )}
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); deleteLog(log) }}
                          title="Apagar diária"
                          aria-label="Apagar diária"
                          className="shrink-0 opacity-30 hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity"
                        >
                          <X className="w-3 h-3" strokeWidth={2.5} />
                        </button>
                        {runEnd && arrowEdge({ kind: "log-extend", id: log.id, from: key }, "right")}
                      </Link>
                    )
                  }
                  return (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      onClick={e => e.stopPropagation()}
                      {...dragProps({ kind: "job", id: j.id, from: key })}
                      title={`${j.name} — ${j.start_date}${j.end_date && j.end_date !== j.start_date ? ` a ${j.end_date}` : ""}${j.status === "completed" ? " (encerrado)" : ""}${offDay ? " · sem diária neste dia" : ""}`}
                      style={offDay ? OFF_DAY_STYLE : undefined}
                      className={cn(
                        offDay
                          ? chip("green", "bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:text-emerald-300/60")
                          : chip(j.status === "completed" ? "grey" : "blue"),
                        "flex items-center gap-1.5 cursor-grab active:cursor-grabbing relative z-10",
                        continuesLeft  && "rounded-l-none -ml-[9px]",
                        continuesRight && "rounded-r-none -mr-[9px]",
                      )}
                    >
                      {showStartEdge && edge({ kind: "job-start", id: j.id, from: key }, "left")}
                      {showLabel ? (
                        <>
                          {grip}
                          {j.stage && <JobStageIcon stage={j.stage} withLabel={false} />}
                          <span className="truncate">{j.name}</span>
                          {j.stage && j.stage !== "work" && j.stage !== "done" && (
                            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 shrink-0">
                              {JOB_STAGE_LABELS[j.stage]}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex-1" aria-hidden />
                      )}
                      {showEndEdge && edge({ kind: "job-end", id: j.id, from: key }, "right")}
                    </Link>
                  )
                })}
                {dayJobs.length > 2 && (
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 px-1 font-medium">
                    +{dayJobs.length - 2} job{dayJobs.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
                {visibleLogs.slice(0, 2).map(l => (
                  <Link
                    key={l.id}
                    href={`/jobs/${l.job_id}`}
                    onClick={e => e.stopPropagation()}
                    {...dragProps({ kind: "log", id: l.id, from: key })}
                    title={`${l.jobs?.name ?? "Diária"} — ${l.hours_billed}h faturadas`}
                    className={cn(chip("green"), "flex items-center gap-1 cursor-grab active:cursor-grabbing")}
                  >
                    {arrowEdge({ kind: "log-extend", id: l.id, from: key }, "left")}
                    {grip}
                    <span className="truncate">{l.jobs?.name ?? "Diária"}</span>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); deleteLog(l) }}
                      title="Apagar diária"
                      aria-label="Apagar diária"
                      className="shrink-0 opacity-40 hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity"
                    >
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                    {arrowEdge({ kind: "log-extend", id: l.id, from: key }, "right")}
                  </Link>
                ))}
                {visibleLogs.length > 2 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 px-1 font-medium">
                    +{visibleLogs.length - 2} diária{visibleLogs.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
                {evs.slice(0, 3).map(e => (
                  <div
                    key={e.id}
                    {...dragProps({ kind: "event", id: e.id, from: key })}
                    className={cn(chip(TASK_TONE[e.task_status] ?? "blue"), "flex items-center gap-1 cursor-grab active:cursor-grabbing")}
                    title={e.title}
                  >
                    {grip}
                    <span className="truncate">
                      {e.title}{e.jobs?.name ? <span className="opacity-70"> • {e.jobs.name}</span> : null}
                    </span>
                  </div>
                ))}
                {evs.length > 3 && (
                  <p className="text-[11px] text-muted-foreground px-1">+{evs.length - 3} mais</p>
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
