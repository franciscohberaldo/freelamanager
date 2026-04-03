"use client"

import { useMemo, useState } from "react"
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
}

const STATUS_COLORS: Record<string, string> = {
  working_on_it: "#f59e0b",
  done:          "#22c55e",
  stuck:         "#ef4444",
  todo:          "#94a3b8",
}

export function CalendarView({ events }: Props) {
  const [month, setMonth] = useState(new Date())

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
            const inMonth = isSameMonth(day, month)
            const today   = isToday(day)
            return (
              <div
                key={i}
                className={[
                  "min-h-24 p-1.5 border-b border-r",
                  !inMonth ? "bg-muted/10" : "",
                  today ? "bg-blue-50 dark:bg-blue-950/20" : "",
                ].join(" ")}
              >
                <div className={[
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  today ? "bg-blue-600 text-white" : inMonth ? "text-foreground" : "text-muted-foreground/40",
                ].join(" ")}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
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
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
