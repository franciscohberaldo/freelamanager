"use client"

import { useMemo, useState } from "react"
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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

const STATUS_COLORS: Record<string, string> = {
  working_on_it: "#f59e0b",
  done:          "#22c55e",
  stuck:         "#ef4444",
  todo:          "#94a3b8",
}

const HOLD_STYLE: Record<CalendarHold["type"], { color: string; label: string }> = {
  "1st_hold": { color: "#f59e0b", label: "1st hold" },
  "2nd_hold": { color: "#94a3b8", label: "2nd hold" },
  "booked":   { color: "#3b82f6", label: "Booked" },
}

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

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-base capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setMonth(m => addMonths(m, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Job em aberto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40" /> Job encerrado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Diária trabalhada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: HOLD_STYLE["1st_hold"].color }} /> 1st hold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: HOLD_STYLE["2nd_hold"].color }} /> 2nd hold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: HOLD_STYLE.booked.color }} /> Booked
        </span>
      </div>

      {/* Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key  = format(day, "yyyy-MM-dd")
            const evs  = eventsByDate[key] ?? []
            const dayLogs = logsByDate[key] ?? []
            const inMonth = isSameMonth(day, month)
            const today   = isToday(day)
            const dayHolds = holdsForDay(key)
            const topHold  = dayHolds[0]
            const dayJobs  = jobsForDay(key)
            return (
              <div
                key={i}
                onClick={() => setSelectedDay(key)}
                className={[
                  "min-h-24 p-1.5 border-b border-r cursor-pointer hover:bg-accent/40 transition-colors",
                  !inMonth ? "bg-muted/10" : "",
                  today ? "bg-blue-50 dark:bg-blue-950/20" : "",
                ].join(" ")}
                style={topHold ? { boxShadow: `inset 0 3px 0 ${HOLD_STYLE[topHold.type].color}` } : undefined}
                title={dayHolds.map(h => `${HOLD_STYLE[h.type].label}: ${h.clients?.name ?? "—"}${h.jobs?.name ? ` · ${h.jobs.name}` : ""}`).join("\n") || undefined}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={[
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    today ? "bg-blue-600 text-white" : inMonth ? "text-foreground" : "text-muted-foreground/40",
                  ].join(" ")}>
                    {format(day, "d")}
                  </div>
                  {topHold && (
                    <span
                      className="text-[10px] leading-none px-1 py-0.5 rounded truncate max-w-[70%]"
                      style={{ background: HOLD_STYLE[topHold.type].color + "22", color: HOLD_STYLE[topHold.type].color }}
                    >
                      {topHold.clients?.name ?? HOLD_STYLE[topHold.type].label}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayJobs.slice(0, 2).map(j => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      onClick={e => e.stopPropagation()}
                      title={`${j.name} — ${j.start_date}${j.end_date && j.end_date !== j.start_date ? ` a ${j.end_date}` : ""}${j.status === "completed" ? " (encerrado)" : ""}`}
                      className={`block text-[10px] px-1.5 py-0.5 rounded truncate ${
                        j.status === "completed"
                          ? "bg-muted text-muted-foreground hover:bg-accent"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                      }`}
                    >
                      {j.name}
                    </Link>
                  ))}
                  {dayJobs.length > 2 && (
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 px-1 font-medium">
                      +{dayJobs.length - 2} job{dayJobs.length - 2 > 1 ? "s" : ""}
                    </div>
                  )}
                  {evs.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate"
                      style={{
                        background: (STATUS_COLORS[e.task_status] ?? "#94a3b8") + "22",
                        borderLeft: `2px solid ${STATUS_COLORS[e.task_status] ?? "#94a3b8"}`,
                        color: "inherit",
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {evs.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{evs.length - 3} mais
                    </div>
                  )}
                  {dayLogs.slice(0, 2).map(l => (
                    <Link
                      key={l.id}
                      href={`/jobs/${l.job_id}`}
                      onClick={e => e.stopPropagation()}
                      title={`${l.jobs?.name ?? "Diária"} — ${l.hours_billed}h faturadas`}
                      className="block text-[10px] px-1.5 py-0.5 rounded truncate bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                    >
                      {l.jobs?.name ?? "Diária"}
                    </Link>
                  ))}
                  {dayLogs.length > 2 && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 px-1 font-medium">
                      +{dayLogs.length - 2} diária{dayLogs.length - 2 > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
