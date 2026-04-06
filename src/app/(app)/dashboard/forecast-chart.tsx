"use client"

import { useMemo } from "react"
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils"

interface MonthLog {
  date: string
  total_value: number
}

interface Props {
  logs: MonthLog[]
}

function linearRegression(points: [number, number][]) {
  const n = points.length
  if (n < 2) return { m: 0, b: points[0]?.[1] ?? 0 }
  const sumX  = points.reduce((s, [x]) => s + x, 0)
  const sumY  = points.reduce((s, [, y]) => s + y, 0)
  const sumXY = points.reduce((s, [x, y]) => s + x * y, 0)
  const sumX2 = points.reduce((s, [x]) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { m: 0, b: sumY / n }
  const m = (n * sumXY - sumX * sumY) / denom
  const b = (sumY - m * sumX) / n
  return { m, b }
}

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

export function ForecastChart({ logs }: Props) {
  const chartData = useMemo(() => {
    // Aggregate monthly totals from all logs
    const monthly: Record<string, number> = {}
    logs.forEach(l => {
      const key = l.date.slice(0, 7) // "yyyy-MM"
      monthly[key] = (monthly[key] ?? 0) + l.total_value
    })

    // Get last 9 months sorted
    const now = new Date()
    const months: { key: string; label: string; index: number }[] = []
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        index: 8 - i,
      })
    }

    // Historical points (last 6 months)
    const histPoints: [number, number][] = []
    months.slice(0, 6).forEach((m, i) => {
      if (monthly[m.key]) histPoints.push([i, monthly[m.key]])
    })

    // Linear regression
    const { m: slope, b: intercept } = linearRegression(histPoints)

    // Build chart points: 6 historical + 3 projected
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    return months.map((m, idx) => {
      const isFuture = m.key > today
      const projected = Math.max(slope * idx + intercept, 0)
      return {
        label:     m.label,
        real:      isFuture ? null : (monthly[m.key] ?? null),
        projecao:  isFuture ? projected : null,
        tendencia: projected,
        isToday:   m.key === today,
      }
    })
  }, [logs])

  const hasData = chartData.some(d => d.real !== null && d.real! > 0)
  if (!hasData) return null

  const todayIdx = chartData.findIndex(d => d.isToday)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number, name: string) => [
            v ? formatCurrency(v) : "—",
            name === "real" ? "Realizado" : name === "projecao" ? "Projeção" : "Tendência",
          ]}
        />
        <Legend
          formatter={v => v === "real" ? "Realizado" : v === "projecao" ? "Projeção (3m)" : "Tendência"}
        />
        {todayIdx >= 0 && (
          <ReferenceLine x={chartData[todayIdx]?.label} stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4" />
        )}
        <Line
          type="monotone" dataKey="tendencia" stroke="hsl(var(--muted-foreground))"
          strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none"
        />
        <Line
          type="monotone" dataKey="real" stroke="#3b82f6"
          strokeWidth={2} dot={{ r: 3 }} connectNulls={false}
        />
        <Line
          type="monotone" dataKey="projecao" stroke="#a855f7"
          strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
