"use client"

import { useMemo } from "react"
import { format, parseISO, differenceInDays, addDays, min, max, startOfDay, isToday } from "date-fns"
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

const DAY_W   = 32
const ROW_H   = 40
const LABEL_W = 220
const HDR_H   = 56

export function GanttView({ events, jobs }: Props) {
  const { start, totalDays, rows, months } = useMemo(() => {
    const dates: Date[] = []
    events.forEach(e => {
      if (e.start_date) dates.push(parseISO(e.start_date))
      dates.push(parseISO(e.event_date))
    })
    jobs.forEach(j => {
      if (j.start_date) dates.push(parseISO(j.start_date))
      if (j.end_date)   dates.push(parseISO(j.end_date))
    })
    if (!dates.length) { const t = new Date(); dates.push(t, addDays(t, 30)) }

    const start     = startOfDay(addDays(min(dates), -3))
    const end       = startOfDay(addDays(max(dates), 7))
    const totalDays = differenceInDays(end, start) + 1

    // Month headers
    const months: { label: string; from: number; count: number }[] = []
    let cur = ""; let mStart = 0
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(start, i)
      const k = format(d, "yyyy-MM")
      if (k !== cur) {
        if (cur) months.push({ label: format(addDays(start, mStart), "MMM yyyy", { locale: ptBR }), from: mStart, count: i - mStart })
        cur = k; mStart = i
      }
    }
    if (cur) months.push({ label: format(addDays(start, mStart), "MMM yyyy", { locale: ptBR }), from: mStart, count: totalDays - mStart })

    const rows = events.map(e => ({
      id:    e.id,
      label: e.title,
      color: STATUS_COLORS[e.task_status] ?? "#94a3b8",
      from:  differenceInDays(parseISO(e.start_date ?? e.event_date), start),
      to:    differenceInDays(parseISO(e.event_date), start),
      done:  e.task_status === "done",
    }))

    return { start, totalDays, rows, months }
  }, [events, jobs])

  const todayOff = differenceInDays(startOfDay(new Date()), start)
  const W = LABEL_W + totalDays * DAY_W
  const H = HDR_H + rows.length * ROW_H + 20

  if (!rows.length) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
      Nenhuma tarefa com datas cadastrada.
    </div>
  )

  return (
    <div className="overflow-x-auto rounded-lg border">
      <svg width={W} height={H} style={{ display: "block", minWidth: W }}>
        {/* Month headers */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={LABEL_W + m.from * DAY_W} y={0} width={m.count * DAY_W} height={HDR_H / 2}
              fill={i % 2 === 0 ? "hsl(var(--muted))" : "hsl(var(--muted)/0.6)"} stroke="hsl(var(--border))" strokeWidth={0.5} />
            <text x={LABEL_W + m.from * DAY_W + (m.count * DAY_W) / 2} y={HDR_H / 4 + 5}
              textAnchor="middle" fontSize={11} fontWeight="600" fill="hsl(var(--foreground))" style={{ textTransform: "capitalize" }}>
              {m.label}
            </text>
          </g>
        ))}

        {/* Day headers */}
        {Array.from({ length: totalDays }, (_, i) => {
          const d = addDays(start, i)
          const weekend = [0, 6].includes(d.getDay())
          const today   = i === todayOff
          return (
            <g key={i}>
              <rect x={LABEL_W + i * DAY_W} y={HDR_H / 2} width={DAY_W} height={HDR_H / 2}
                fill={today ? "#dbeafe" : weekend ? "hsl(var(--muted)/0.4)" : "hsl(var(--background))"}
                stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={LABEL_W + i * DAY_W + DAY_W / 2} y={HDR_H - 7}
                textAnchor="middle" fontSize={9}
                fill={today ? "#1e40af" : weekend ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))"}
                fontWeight={today ? "bold" : "normal"}>
                {format(d, "d")}
              </text>
            </g>
          )
        })}

        {/* Rows */}
        {rows.map((row, ri) => {
          const y      = HDR_H + ri * ROW_H
          const barX   = LABEL_W + row.from * DAY_W + 2
          const barW   = Math.max((row.to - row.from + 1) * DAY_W - 4, 8)
          return (
            <g key={row.id}>
              <rect x={0} y={y} width={W} height={ROW_H}
                fill={ri % 2 === 0 ? "hsl(var(--background))" : "hsl(var(--muted)/0.2)"}
                stroke="hsl(var(--border))" strokeWidth={0.3} />
              {/* Grid columns */}
              {Array.from({ length: totalDays }, (_, i) => (
                <rect key={i} x={LABEL_W + i * DAY_W} y={y} width={DAY_W} height={ROW_H}
                  fill={i === todayOff ? "rgba(219,234,254,0.3)" : "transparent"}
                  stroke="hsl(var(--border))" strokeWidth={0.2} />
              ))}
              {/* Label */}
              <text x={12} y={y + ROW_H / 2 + 5} fontSize={12}
                fill={row.done ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))"}
                textDecoration={row.done ? "line-through" : "none"}>
                {row.label.length > 24 ? row.label.slice(0, 24) + "…" : row.label}
              </text>
              {/* Bar */}
              <rect x={barX} y={y + ROW_H / 2 - 9} width={barW} height={18}
                rx={4} fill={row.color} opacity={row.done ? 0.5 : 0.85} />
            </g>
          )
        })}

        {/* Today line */}
        {todayOff >= 0 && todayOff < totalDays && (
          <line x1={LABEL_W + todayOff * DAY_W + DAY_W / 2} y1={0}
            x2={LABEL_W + todayOff * DAY_W + DAY_W / 2} y2={H}
            stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
        )}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={H} stroke="hsl(var(--border))" strokeWidth={1} />
      </svg>
    </div>
  )
}
