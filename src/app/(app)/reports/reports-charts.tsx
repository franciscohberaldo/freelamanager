"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils"

interface MonthData {
  month: string
  faturado: number
  horasTrabalhadas: number
  horasFaturadas: number
  despesas?: number
}

export function ReportsCharts({ monthly }: { monthly: MonthData[] }) {
  const hasExpenses = monthly.some(m => (m.despesas ?? 0) > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Receita vs Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {hasExpenses ? "Receita vs Despesas" : "Faturamento mensal"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  formatCurrency(v),
                  name === "faturado" ? "Faturado" : name === "despesas" ? "Despesas" : name,
                ]}
              />
              {hasExpenses && <Legend formatter={(v) => v === "faturado" ? "Receita" : "Despesas"} />}
              <Bar dataKey="faturado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              {hasExpenses && (
                <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              )}
              {!hasExpenses && (
                <Line type="monotone" dataKey="faturado" stroke="#f59e0b" strokeWidth={2} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Horas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horas trabalhadas vs faturadas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v.toFixed(1)}h`,
                  name === "horasTrabalhadas" ? "Trabalhadas" : "Faturadas",
                ]}
              />
              <Legend formatter={(v) => v === "horasTrabalhadas" ? "Trabalhadas" : "Faturadas"} />
              <Bar dataKey="horasTrabalhadas" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="horasFaturadas"   fill="#3b82f6"  radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
