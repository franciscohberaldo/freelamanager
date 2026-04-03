"use client"

import { useMemo } from "react"
import { format, parseISO, differenceInDays, addDays, min, max, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job { id: string; name: string; start_date: string | null; end_date: string | null; status: string }
interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  jobs: Job[]
}

const STATUS_COLORS: Record<string, string> = {
  working_on_it: "#f59e0b",
  done:          "#22c55e",
  stuck:         "#ef4444",
  todo:          "#94a3b8",
}

const STATUS_LABELS: Record<string, string> = {
  working_on_it: "Working on it",
  done:          "Done",
  stuck:         "Stuck",
  todo:          "To-Do",
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#3b82f6",
}

export function TimelineView({ events, jobs }: Props) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  )

  // Group by month
  const groups = useMemo(() => {
    const map: Record<string, typeof sorted> = {}
    sorted.forEach(e => {
      const k = e.event_date.slice(0, 7) // yyyy-MM
      if (!map[k]) map[k] = []
      map[k].push(e)
    })
    return Object.entries(map).map(([key, items]) => ({
      key,
      label: format(parseISO(key + "-01"), "MMMM yyyy", { locale: ptBR }),
      items,
    }))
  }, [sorted])

  if (!events.length) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
      Nenhuma tarefa cadastrada.
    </div>
  )

  return (
    <div className="space-y-8">
      {groups.map(group => (
        <div key={group.key}>
          <h3 className="text-sm font-semibold text-muted-foreground capitalize mb-3 sticky top-0 bg-background/80 backdrop-blur py-1">
            {group.label}
          </h3>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {group.items.map(e => {
                const color = STATUS_COLORS[e.task_status] ?? "#94a3b8"
                return (
                  <div key={e.id} className="relative flex gap-4">
                    {/* Dot */}
                    <div
                      className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-background shrink-0"
                      style={{ background: color }}
                    />

                    {/* Card */}
                    <div className="flex-1 rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={[
                            "text-sm font-medium truncate",
                            e.task_status === "done" ? "line-through text-muted-foreground" : "",
                          ].join(" ")}>
                            {e.title}
                          </p>
                          {e.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {e.description}
                            </p>
                          )}
                          {e.jobs && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Job: {e.jobs.name}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: color + "22", color }}
                          >
                            {STATUS_LABELS[e.task_status] ?? e.task_status}
                          </span>
                          {e.priority && PRIORITY_COLORS[e.priority] && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: PRIORITY_COLORS[e.priority] + "22", color: PRIORITY_COLORS[e.priority] }}
                            >
                              {e.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          {e.start_date
                            ? `${format(parseISO(e.start_date), "dd MMM", { locale: ptBR })} → ${format(parseISO(e.event_date), "dd MMM", { locale: ptBR })}`
                            : format(parseISO(e.event_date), "dd MMM yyyy", { locale: ptBR })
                          }
                        </span>
                        {e.budget != null && (
                          <span className="font-medium text-foreground">
                            R$ {e.budget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
