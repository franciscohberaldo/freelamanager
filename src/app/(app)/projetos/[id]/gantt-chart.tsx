"use client"

import { useMemo } from "react"
import { addDays, differenceInDays, format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isToday } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Task {
  id: string; title: string; status: string; progress: number
  start_date: string | null; end_date: string | null; color?: string
}

interface Props { tasks: Task[]; projectColor: string }

const STATUS_BG: Record<string, string> = {
  todo:        "#94a3b8",
  in_progress: "#3b82f6",
  done:        "#22c55e",
  blocked:     "#ef4444",
}
const STATUS_LABEL: Record<string, string> = {
  todo: "A fazer", in_progress: "Em andamento", done: "Concluído", blocked: "Bloqueado",
}

const DAY_W = 28 // pixels per day

export function GanttChart({ tasks, projectColor }: Props) {
  const scheduledTasks = tasks.filter(t => t.start_date && t.end_date)

  const { minDate, maxDate, totalDays, months } = useMemo(() => {
    if (!scheduledTasks.length) return { minDate: new Date(), maxDate: new Date(), totalDays: 30, months: [] }

    const starts = scheduledTasks.map(t => parseISO(t.start_date!))
    const ends   = scheduledTasks.map(t => parseISO(t.end_date!))
    const min = new Date(Math.min(...starts.map(d => d.getTime())))
    const max = new Date(Math.max(...ends.map(d => d.getTime())))
    const paddedMin = addDays(startOfMonth(min), 0)
    const paddedMax = endOfMonth(max)
    const total = differenceInDays(paddedMax, paddedMin) + 1
    const mons  = eachMonthOfInterval({ start: paddedMin, end: paddedMax })
    return { minDate: paddedMin, maxDate: paddedMax, totalDays: total, months: mons }
  }, [scheduledTasks])

  const todayOffset = differenceInDays(new Date(), minDate)
  const totalWidth  = totalDays * DAY_W

  if (!scheduledTasks.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg bg-muted/20">
        Adicione datas de início e fim nas tarefas para ver o Gantt
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex">
        {/* Left panel — task names */}
        <div className="w-56 shrink-0 border-r bg-muted/20">
          {/* Header spacer */}
          <div className="h-10 border-b flex items-center px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefa</span>
          </div>
          {scheduledTasks.map(t => (
            <div key={t.id} className="h-12 border-b flex items-center gap-2 px-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_BG[t.status] }} />
              <span className="text-sm truncate font-medium">{t.title}</span>
            </div>
          ))}
        </div>

        {/* Right panel — timeline */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Month headers */}
            <div className="h-10 border-b flex relative">
              {months.map(m => {
                const daysInMonth = differenceInDays(
                  endOfMonth(m) < maxDate ? endOfMonth(m) : maxDate,
                  m < minDate ? minDate : startOfMonth(m)
                ) + 1
                return (
                  <div key={m.toISOString()}
                    className="border-r flex items-center px-2 shrink-0"
                    style={{ width: daysInMonth * DAY_W }}>
                    <span className="text-xs font-semibold capitalize text-muted-foreground">
                      {format(m, "MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Task rows */}
            <div className="relative">
              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                  style={{ left: todayOffset * DAY_W + DAY_W / 2 }}
                />
              )}

              {scheduledTasks.map(t => {
                const start  = parseISO(t.start_date!)
                const end    = parseISO(t.end_date!)
                const left   = differenceInDays(start, minDate) * DAY_W
                const width  = Math.max((differenceInDays(end, start) + 1) * DAY_W, DAY_W)
                const bg     = STATUS_BG[t.status]
                const fillW  = Math.round(t.progress)

                return (
                  <div key={t.id} className="h-12 border-b flex items-center relative">
                    {/* Grid lines */}
                    {months.map(m => {
                      const offset = differenceInDays(
                        m < minDate ? minDate : startOfMonth(m), minDate
                      ) * DAY_W
                      return (
                        <div key={m.toISOString()} className="absolute top-0 bottom-0 border-r border-muted"
                          style={{ left: offset }} />
                      )
                    })}

                    {/* Bar */}
                    <div
                      className="absolute h-7 rounded-md overflow-hidden shadow-sm flex items-center"
                      style={{ left: left + 2, width: width - 4, background: bg + "33", border: `1.5px solid ${bg}` }}
                      title={`${t.title} — ${STATUS_LABEL[t.status]} — ${t.progress}%`}
                    >
                      {/* Progress fill */}
                      <div className="absolute left-0 top-0 bottom-0 rounded-l-md transition-all"
                        style={{ width: `${fillW}%`, background: bg + "66" }} />
                      {/* Label */}
                      <span className="relative z-10 px-2 text-xs font-semibold truncate" style={{ color: bg }}>
                        {t.title}{t.progress > 0 ? ` ${t.progress}%` : ""}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
