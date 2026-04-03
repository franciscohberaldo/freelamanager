"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useMemo } from "react"
import { format, parseISO, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Log {
  date: string
  total_value: number
  hours_billed: number
}

export function DashboardCharts({ logs }: { logs: Log[] }) {
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    })

    return months.map((month) => {
      const key = format(month, "yyyy-MM")
      const monthLogs = logs.filter((l) => l.date.startsWith(key))
      return {
        month: format(month, "MMM/yy", { locale: ptBR }),
        faturado: monthLogs.reduce((s, l) => s + l.total_value, 0),
        horas: monthLogs.reduce((s, l) => s + l.hours_billed, 0),
      }
    })
  }, [logs])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFaturado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221.2, 83.2%, 53.3%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(221.2, 83.2%, 53.3%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), "Faturado"]} />
              <Area
                type="monotone"
                dataKey="faturado"
                stroke="hsl(221.2, 83.2%, 53.3%)"
                fill="url(#colorFaturado)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horas faturadas — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v}h`, "Horas"]} />
              <Bar dataKey="horas" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
