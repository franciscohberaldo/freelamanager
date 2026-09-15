"use client"

import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardCharts } from "./dashboard-charts"
import { ForecastChart } from "./forecast-chart"
import { format } from "date-fns"
import {
  TrendingUp, Clock, FileText, Target, Wallet,
} from "lucide-react"
import Link from "next/link"

interface MonthLog {
  hours_worked: number
  hours_billed: number
  total_value: number
}

interface Job {
  id: string
  name: string
  hourly_rate: number
  currency: string
  clients: unknown
}

interface Invoice {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: string
  period_start: string
  period_end: string
  jobs: unknown
}

interface AgendaEvent {
  id: string
  title: string
  type: string
  event_date: string
  is_done: boolean
  jobs: unknown
}

interface Goal {
  id: string
  type: string
  target: number
  period: string
}

interface ChartLog {
  date: string
  total_value: number
  hours_billed: number
}

interface ForecastLog {
  date: string
  total_value: number
}

export interface MonthlyViewProps {
  now: string
  monthLogs: MonthLog[]
  activeJobs: Job[]
  recentInvoices: Invoice[]
  upcomingEvents: AgendaEvent[]
  allMonthlyData: ChartLog[]
  monthExpenses: { amount: number }[]
  goals: Goal[]
  forecastLogs: ForecastLog[]
}

const invoiceStatusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" }> = {
  draft:   { label: "Rascunho", variant: "outline" },
  sent:    { label: "Enviado",  variant: "warning" },
  paid:    { label: "Pago",     variant: "success" },
  overdue: { label: "Vencido",  variant: "destructive" },
}

const eventTypeIcons: Record<string, string> = {
  payment:   "💰",
  delivery:  "📦",
  meeting:   "🗣️",
  milestone: "🏆",
  deadline:  "⚠️",
}

export function MonthlyView({
  now,
  monthLogs,
  activeJobs,
  recentInvoices,
  upcomingEvents,
  allMonthlyData,
  monthExpenses,
  goals,
  forecastLogs,
}: MonthlyViewProps) {
  const nowDate = new Date(now)

  const totalBilledMonth = monthLogs.reduce((sum, l) => sum + l.total_value, 0)
  const totalHoursWorked = monthLogs.reduce((sum, l) => sum + l.hours_worked, 0)
  const totalHoursBilled = monthLogs.reduce((sum, l) => sum + l.hours_billed, 0)
  const pendingInvoices  = recentInvoices.filter(i => i.status === "sent").length
  const totalExpenses    = monthExpenses.reduce((sum, e) => sum + e.amount, 0)
  const netRevenue       = totalBilledMonth - totalExpenses

  const revenueGoal = goals.find(g => g.type === "revenue_month")
  const hoursGoal   = goals.find(g => g.type === "hours_month")

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {format(nowDate, "MMMM 'de' yyyy")} — visão geral do mês
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturado no mês</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-light tracking-tight">{formatCurrency(totalBilledMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalHoursBilled}h faturadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Horas trabalhadas</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-light tracking-tight">{totalHoursWorked}h</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalHoursBilled > 0 && totalHoursWorked > 0
                ? `${((totalHoursBilled / totalHoursWorked) * 100).toFixed(0)}% faturado`
                : "Sem registros"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas no mês</CardTitle>
            <Wallet className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-light tracking-tight text-destructive">{formatCurrency(totalExpenses)}</p>
            <p className={`text-xs mt-1 font-medium ${netRevenue >= 0 ? "text-green-600" : "text-red-500"}`}>
              Líquido: {formatCurrency(netRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices pendentes</CardTitle>
            <FileText className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-light tracking-tight">{pendingInvoices}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeJobs.length} jobs ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      {(revenueGoal || hoursGoal) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueGoal && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Meta de receita</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {Math.min(Math.round((totalBilledMonth / revenueGoal.target) * 100), 100)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min((totalBilledMonth / revenueGoal.target) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalBilledMonth)} de {formatCurrency(revenueGoal.target)}
                </p>
              </CardContent>
            </Card>
          )}
          {hoursGoal && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Meta de horas</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {Math.min(Math.round((totalHoursWorked / hoursGoal.target) * 100), 100)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min((totalHoursWorked / hoursGoal.target) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalHoursWorked}h de {hoursGoal.target}h
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!revenueGoal && !hoursGoal && (
        <Link href="/metas" className="block">
          <Card className="border-dashed hover:bg-accent/30 transition-colors cursor-pointer">
            <CardContent className="py-4 flex items-center gap-3 text-muted-foreground">
              <Target className="w-4 h-4" />
              <p className="text-sm">Defina metas mensais de receita e horas → <span className="underline">Metas</span></p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Charts */}
      <DashboardCharts logs={allMonthlyData} />

      {/* Revenue Forecast */}
      {forecastLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              Previsão de receita — próximos 3 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastChart logs={forecastLogs} />
            <p className="text-xs text-muted-foreground mt-3">
              Projeção baseada em regressão linear dos últimos 6 meses de faturamento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum invoice ainda.</p>
            )}
            {recentInvoices.map((inv) => {
              const status = invoiceStatusMap[inv.status] ?? { label: inv.status, variant: "outline" as const }
              return (
                <div key={inv.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">#{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {(inv.jobs as unknown as { name: string } | null)?.name} · {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <Badge variant={status.variant as "default"}>{status.label}</Badge>
                    <span className="text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>
            )}
            {upcomingEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3">
                <span className="text-lg">{eventTypeIcons[ev.type] ?? "📅"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(ev.jobs as unknown as { name: string } | null)?.name} · {formatDate(ev.event_date, "dd/MM")}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
