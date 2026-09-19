"use client"

import { useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { AgendaEvent } from "@/lib/supabase/types"
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

export function CalendarView({ events, holds = [], logs = [], jobs = [], pickerJobs = [] }: Props) {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

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
              className={cn(
                "min-h-[140px] p-2 border-b cursor-pointer transition-colors",
                i % 7 !== 0 && "border-l",
                today ? "bg-accent/40" : "hover:bg-muted/40",
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
                  <span className={chip(HOLD_TONE[topHold.type].tone, "max-w-[65%] text-[11px]")}>
                    {topHold.clients?.name ?? HOLD_TONE[topHold.type].label}
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
                    className={chip(j.status === "completed" ? "grey" : "blue")}
                  >
                    {j.name}
                  </Link>
                ))}
                {dayJobs.length > 2 && (
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 px-1 font-medium">
                    +{dayJobs.length - 2} job{dayJobs.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
                {evs.slice(0, 3).map(e => (
                  <div key={e.id} className={chip(TASK_TONE[e.task_status] ?? "blue")} title={e.title}>
                    {e.title}{e.jobs?.name ? <span className="opacity-70"> • {e.jobs.name}</span> : null}
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
                    className={chip("green")}
                  >
                    {l.jobs?.name ?? "Diária"}
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
