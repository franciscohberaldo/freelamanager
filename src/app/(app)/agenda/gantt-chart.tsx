"use client"

import { useMemo } from "react"
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, formatDate } from "@/lib/utils"
import { format, parseISO, differenceInDays, startOfDay, addDays, min, max } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40
const LABEL_WIDTH = 200
const DAY_WIDTH = 28

export function GanttChart({ events, jobs }: Props) {
  const { chartStart, chartEnd, totalDays, rows } = useMemo(() => {
    const allDates: Date[] = []

    // Collect dates from jobs
    jobs.forEach((j) => {
      if (j.start_date) allDates.push(parseISO(j.start_date))
      if (j.end_date) allDates.push(parseISO(j.end_date))
    })

    // Collect dates from events
    events.forEach((e) => allDates.push(parseISO(e.event_date)))

    if (allDates.length === 0) {
      const today = new Date()
      allDates.push(today, addDays(today, 30))
    }

    const chartStart = startOfDay(addDays(min(allDates), -3))
    const chartEnd = startOfDay(addDays(max(allDates), 7))
    const totalDays = differenceInDays(chartEnd, chartStart) + 1

    // Build rows: jobs first, then events
    const rows: {
      id: string
      label: string
      type: "job" | "event"
      start: Date
      end: Date
      color: string
      isDone?: boolean
      eventType?: string
    }[] = []

    jobs.forEach((j) => {
      if (j.start_date && j.end_date) {
        rows.push({
          id: j.id,
          label: j.name,
          type: "job",
          start: parseISO(j.start_date),
          end: parseISO(j.end_date),
          color: j.status === "active" ? "#3b82f6" : j.status === "paused" ? "#f59e0b" : "#6b7280",
        })
      }
    })

    events.forEach((e) => {
      rows.push({
        id: e.id,
        label: e.title,
        type: "event",
        start: parseISO(e.event_date),
        end: parseISO(e.event_date),
        color: EVENT_TYPE_COLORS[e.type] ?? "#6b7280",
        isDone: e.is_done,
        eventType: e.type,
      })
    })

    return { chartStart, chartEnd, totalDays, rows }
  }, [events, jobs])

  const today = startOfDay(new Date())
  const todayOffset = differenceInDays(today, chartStart)

  // Generate month headers
  const months: { label: string; dayStart: number; days: number }[] = []
  let currentMonth = ""
  let monthStart = 0

  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(chartStart, i)
    const mKey = format(d, "yyyy-MM")
    if (mKey !== currentMonth) {
      if (currentMonth) months.push({ label: format(addDays(chartStart, monthStart), "MMM/yy", { locale: ptBR }), dayStart: monthStart, days: i - monthStart })
      currentMonth = mKey
      monthStart = i
    }
  }
  if (currentMonth) months.push({ label: format(addDays(chartStart, monthStart), "MMM/yy", { locale: ptBR }), dayStart: monthStart, days: totalDays - monthStart })

  const totalWidth = LABEL_WIDTH + totalDays * DAY_WIDTH
  const totalHeight = HEADER_HEIGHT * 2 + rows.length * ROW_HEIGHT + 20

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Adicione eventos ou jobs com datas para visualizar o Gantt.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gantt</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <svg
          width={totalWidth}
          height={totalHeight}
          style={{ minWidth: totalWidth, display: "block" }}
        >
          {/* Month headers */}
          {months.map((m) => (
            <g key={m.dayStart}>
              <rect
                x={LABEL_WIDTH + m.dayStart * DAY_WIDTH}
                y={0}
                width={m.days * DAY_WIDTH}
                height={HEADER_HEIGHT}
                fill={m.dayStart % 2 === 0 ? "#f8faff" : "#f0f4ff"}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
              <text
                x={LABEL_WIDTH + m.dayStart * DAY_WIDTH + (m.days * DAY_WIDTH) / 2}
                y={HEADER_HEIGHT / 2 + 5}
                textAnchor="middle"
                fontSize={11}
                fontWeight="600"
                fill="#374151"
                style={{ textTransform: "capitalize" }}
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Day headers */}
          {Array.from({ length: totalDays }, (_, i) => {
            const d = addDays(chartStart, i)
            const isWeekend = [0, 6].includes(d.getDay())
            const isTodayCol = i === todayOffset
            return (
              <g key={i}>
                <rect
                  x={LABEL_WIDTH + i * DAY_WIDTH}
                  y={HEADER_HEIGHT}
                  width={DAY_WIDTH}
                  height={HEADER_HEIGHT}
                  fill={isTodayCol ? "#dbeafe" : isWeekend ? "#fafafa" : "white"}
                  stroke="#e5e7eb"
                  strokeWidth={0.5}
                />
                <text
                  x={LABEL_WIDTH + i * DAY_WIDTH + DAY_WIDTH / 2}
                  y={HEADER_HEIGHT + HEADER_HEIGHT / 2 + 5}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isTodayCol ? "#1e40af" : isWeekend ? "#9ca3af" : "#6b7280"}
                  fontWeight={isTodayCol ? "bold" : "normal"}
                >
                  {format(d, "d")}
                </text>
              </g>
            )
          })}

          {/* Grid rows */}
          {rows.map((row, rowIdx) => {
            const y = HEADER_HEIGHT * 2 + rowIdx * ROW_HEIGHT
            const startOffset = Math.max(0, differenceInDays(row.start, chartStart))
            const endOffset = Math.min(totalDays - 1, differenceInDays(row.end, chartStart))
            const barWidth = Math.max((endOffset - startOffset + 1) * DAY_WIDTH, row.type === "event" ? 16 : 20)
            const barX = LABEL_WIDTH + startOffset * DAY_WIDTH
            const barY = y + ROW_HEIGHT / 2 - 10

            return (
              <g key={row.id}>
                {/* Row background */}
                <rect
                  x={0}
                  y={y}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill={rowIdx % 2 === 0 ? "white" : "#fafafa"}
                  stroke="#f3f4f6"
                  strokeWidth={0.5}
                />

                {/* Grid cells */}
                {Array.from({ length: totalDays }, (_, i) => {
                  const d = addDays(chartStart, i)
                  const isWeekend = [0, 6].includes(d.getDay())
                  return (
                    <rect
                      key={i}
                      x={LABEL_WIDTH + i * DAY_WIDTH}
                      y={y}
                      width={DAY_WIDTH}
                      height={ROW_HEIGHT}
                      fill={i === todayOffset ? "rgba(219,234,254,0.4)" : isWeekend ? "rgba(249,250,251,0.8)" : "transparent"}
                      stroke="#f3f4f6"
                      strokeWidth={0.5}
                    />
                  )
                })}

                {/* Row label */}
                <text
                  x={8}
                  y={y + ROW_HEIGHT / 2 + 5}
                  fontSize={11}
                  fill={row.isDone ? "#9ca3af" : "#374151"}
                  fontWeight={row.type === "job" ? "600" : "normal"}
                  textDecoration={row.isDone ? "line-through" : "none"}
                >
                  {row.type === "event" ? "●  " : ""}
                  {row.label.length > 22 ? row.label.slice(0, 22) + "…" : row.label}
                </text>

                {/* Bar / marker */}
                {row.type === "job" ? (
                  <rect
                    x={barX + 2}
                    y={barY + 2}
                    width={Math.max(barWidth - 4, 4)}
                    height={16}
                    rx={4}
                    fill={row.color}
                    opacity={row.isDone ? 0.4 : 0.85}
                  />
                ) : (
                  /* Diamond marker for events */
                  <polygon
                    points={`
                      ${barX + 8},${barY}
                      ${barX + 16},${barY + 8}
                      ${barX + 8},${barY + 16}
                      ${barX},${barY + 8}
                    `}
                    fill={row.isDone ? "#9ca3af" : row.color}
                    opacity={row.isDone ? 0.5 : 1}
                  />
                )}
              </g>
            )
          })}

          {/* Today vertical line */}
          {todayOffset >= 0 && todayOffset < totalDays && (
            <line
              x1={LABEL_WIDTH + todayOffset * DAY_WIDTH + DAY_WIDTH / 2}
              y1={0}
              x2={LABEL_WIDTH + todayOffset * DAY_WIDTH + DAY_WIDTH / 2}
              y2={totalHeight}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          )}

          {/* Label separator line */}
          <line x1={LABEL_WIDTH} y1={0} x2={LABEL_WIDTH} y2={totalHeight} stroke="#d1d5db" strokeWidth={1} />
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-6 p-4 border-t flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-8 h-4 rounded bg-blue-500 opacity-85" />
            Job ativo
          </div>
          {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-4 h-4 rotate-45" style={{ background: EVENT_TYPE_COLORS[type] }} />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-0 border-t-2 border-dashed border-red-500" style={{ width: 20 }} />
            Hoje
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
