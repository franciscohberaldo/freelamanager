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
}

export function ReportsCharts({ monthly }: { monthly: MonthData[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), "Faturado"]} />
              <Bar dataKey="faturado" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="faturado" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
              <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}h`, name === "horasTrabalhadas" ? "Trabalhadas" : "Faturadas"]} />
              <Legend formatter={(v) => v === "horasTrabalhadas" ? "Trabalhadas" : "Faturadas"} />
              <Bar dataKey="horasTrabalhadas" fill="#e2e8f0" radius={[4,4,0,0]} />
              <Bar dataKey="horasFaturadas" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4,4,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
