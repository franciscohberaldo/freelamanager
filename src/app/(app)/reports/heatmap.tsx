"use client"

import { useMemo } from "react"
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Props {
  logs: { date: string; hours_worked: number }[]
  year: number
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const DAYS   = ["Seg","","Qua","","Sex","","Dom"]

export function ProductivityHeatmap({ logs, year }: Props) {
  const { weeks, maxHours, monthPositions } = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1))
    const end   = endOfYear(new Date(year, 0, 1))

    // Map date -> hours
    const hoursMap: Record<string, number> = {}
    logs.forEach(l => { hoursMap[l.date] = (hoursMap[l.date] ?? 0) + l.hours_worked })
    const maxHours = Math.max(...Object.values(hoursMap), 1)

    // Build grid — pad to Monday start
    // getDay: 0=Sun, 1=Mon...6=Sat → convert to Mon-based (0=Mon...6=Sun)
    const startDow = getDay(start) // 0=Sun
    const padBefore = startDow === 0 ? 6 : startDow - 1 // cells to pad before Jan 1

    const allDays = eachDayOfInterval({ start, end })
    const cells: { date: string; hours: number; valid: boolean }[] = [
      ...Array.from({ length: padBefore }, () => ({ date: "", hours: 0, valid: false })),
      ...allDays.map(d => {
        const ds = format(d, "yyyy-MM-dd")
        return { date: ds, hours: hoursMap[ds] ?? 0, valid: true }
      }),
    ]

    // Group into columns of 7 (Mon–Sun)
    const weeks: typeof cells[] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }

    // Month label positions: first column where that month appears
    const monthPositions: Record<number, number> = {}
    weeks.forEach((week, wi) => {
      week.forEach(cell => {
        if (!cell.valid) return
        const m = parseInt(cell.date.slice(5, 7)) - 1
        if (!(m in monthPositions)) monthPositions[m] = wi
      })
    })

    return { weeks, maxHours, monthPositions }
  }, [logs, year])

  function cellColor(hours: number, valid: boolean) {
    if (!valid) return "transparent"
    if (hours === 0) return undefined // use CSS class
    const lvl = Math.ceil((hours / maxHours) * 4)
    const opacity = [0.25, 0.45, 0.65, 0.9][lvl - 1] ?? 0.9
    return `hsl(var(--primary) / ${opacity})`
  }

  const totalHours = logs.reduce((s, l) => s + l.hours_worked, 0)
  const activeDays = new Set(logs.map(l => l.date)).size

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Mapa de produtividade</span>
        <span className="text-muted-foreground text-xs">
          {totalHours.toFixed(1)}h em {activeDays} dias
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-0 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col pt-5 pr-1.5 gap-[2px]">
            {DAYS.map((d, i) => (
              <div key={i} className="h-3 text-[9px] text-muted-foreground leading-3 flex items-center">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => {
              const monthIdx = Object.entries(monthPositions).find(([, pos]) => pos === wi)
              const monthLabel = monthIdx ? MONTHS[parseInt(monthIdx[0])] : ""
              return (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {/* Month label row */}
                  <div className="h-4 text-[9px] text-muted-foreground leading-4 whitespace-nowrap">
                    {monthLabel}
                  </div>
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-[2px] transition-opacity"
                      style={{
                        background: cellColor(cell.hours, cell.valid) ?? (cell.valid ? "hsl(var(--muted))" : "transparent"),
                      }}
                      title={cell.valid ? `${cell.date}: ${cell.hours.toFixed(1)}h` : undefined}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-[2px] bg-muted" />
        {[0.25, 0.45, 0.65, 0.9].map((op, i) => (
          <div key={i} className="w-3 h-3 rounded-[2px]"
            style={{ background: `hsl(var(--primary) / ${op})` }} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}
