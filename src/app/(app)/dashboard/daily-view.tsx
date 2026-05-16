"use client"

import { formatCurrency, formatHours, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertTriangle, Target, FileText } from "lucide-react"
import Link from "next/link"

interface TodayLog {
  id: string
  hours_worked: number
  hours_billed: number
  total_value: number
  notes: string | null
  jobs: { id: string; name: string; clients: { name: string } | null } | null
}

interface TodayEvent {
  id: string
  title: string
  type: string
  event_date: string
  is_done: boolean
  jobs: { name: string } | null
}

interface OverdueInvoice {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: string
  due_date: string
  jobs: { name: string; clients: { name: string } | null } | null
}

interface Goal {
  id: string
  type: string
  target: number
  period: string
}

interface MonthLog {
  hours_worked: number
  hours_billed: number
  total_value: number
}

export interface DailyViewProps {
  todayLogs: TodayLog[]
  todayEvents: TodayEvent[]
  overdueInvoices: OverdueInvoice[]
  goals: Goal[]
  monthLogs: MonthLog[]
}

const eventTypeIcons: Record<string, string> = {
  payment: "💰",
  delivery: "📦",
  meeting: "🗣️",
  milestone: "🏆",
  deadline: "⚠️",
}

export function DailyView({
  todayLogs,
  todayEvents,
  overdueInvoices,
  goals,
  monthLogs,
}: DailyViewProps) {
  const totalHoursToday = todayLogs.reduce((sum, l) => sum + l.hours_worked, 0)
  const totalValueToday = todayLogs.reduce((sum, l) => sum + l.total_value, 0)
  const pendingEvents = todayEvents.filter((e) => !e.is_done)
  const doneEvents = todayEvents.filter((e) => e.is_done)

  const totalHoursMonth = monthLogs.reduce((sum, l) => sum + l.hours_worked, 0)
  const totalRevenueMonth = monthLogs.reduce((sum, l) => sum + l.total_value, 0)
  const revenueGoal = goals.find((g) => g.type === "revenue_month")
  const hoursGoal = goals.find((g) => g.type === "hours_month")

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {formatDate(new Date(), "EEEE, dd 'de' MMMM")} — visão do dia
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Horas hoje</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatHours(totalHoursToday)}</p>
            {todayLogs.length > 0 ? (
              <div className="mt-2 space-y-1">
                {todayLogs.map((log) => (
                  <p key={log.id} className="text-xs text-muted-foreground">
                    {(log.jobs as unknown as { name: string } | null)?.name ?? "Sem job"} — {formatHours(log.hours_worked)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Nenhum registro hoje</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tarefas de hoje</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {todayEvents.length > 0
                ? `${doneEvents.length}/${todayEvents.length}`
                : "0"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingEvents.length > 0
                ? `${pendingEvents.length} pendente${pendingEvents.length > 1 ? "s" : ""}`
                : todayEvents.length > 0
                  ? "Tudo concluído"
                  : "Nenhuma tarefa hoje"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices vencidas</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{overdueInvoices.length}</p>
              {overdueInvoices.length > 0 && (
                <Badge variant="destructive" className="text-xs">Atenção</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overdueInvoices.length > 0
                ? formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.total, 0))
                : "Nenhum invoice vencido"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      {(revenueGoal || hoursGoal) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueGoal && (() => {
            const pct = revenueGoal.target > 0 ? Math.min((totalRevenueMonth / revenueGoal.target) * 100, 100) : 0
            const todayPct = revenueGoal.target > 0 ? Math.min((totalValueToday / revenueGoal.target) * 100, 100) : 0
            return (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Meta de receita</span>
                    </div>
                    <span className="text-sm font-semibold">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all flex">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${Math.max(pct - todayPct, 0)}%` }}
                      />
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${todayPct}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalRevenueMonth)} de {formatCurrency(revenueGoal.target)}
                    {totalValueToday > 0 && (
                      <span className="text-primary font-medium"> (+{formatCurrency(totalValueToday)} hoje)</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })()}
          {hoursGoal && (() => {
            const pct = hoursGoal.target > 0 ? Math.min((totalHoursMonth / hoursGoal.target) * 100, 100) : 0
            const todayPct = hoursGoal.target > 0 ? Math.min((totalHoursToday / hoursGoal.target) * 100, 100) : 0
            return (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Meta de horas</span>
                    </div>
                    <span className="text-sm font-semibold">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all flex">
                      <div
                        className="h-full bg-blue-500/60"
                        style={{ width: `${Math.max(pct - todayPct, 0)}%` }}
                      />
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${todayPct}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatHours(totalHoursMonth)} de {formatHours(hoursGoal.target)}
                    {totalHoursToday > 0 && (
                      <span className="text-blue-600 font-medium"> (+{formatHours(totalHoursToday)} hoje)</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })()}
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

      {/* Today's Agenda */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Agenda de hoje</CardTitle>
          <Link href="/agenda" className="text-xs text-primary hover:underline">
            Ver tudo →
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {todayEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa hoje.</p>
          )}
          {todayEvents.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3">
              <span className="text-lg">{eventTypeIcons[ev.type] ?? "📅"}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${ev.is_done ? "line-through text-muted-foreground" : ""}`}>
                  {ev.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(ev.jobs as unknown as { name: string } | null)?.name ?? "Sem job"}
                </p>
              </div>
              <Badge variant={ev.is_done ? "outline" : "default"} className="shrink-0">
                {ev.is_done ? "Feito" : "Pendente"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              Invoices vencidas
            </CardTitle>
            <Link href="/invoices" className="text-xs text-primary hover:underline">
              Ver tudo →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">#{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(inv.jobs as unknown as { name: string; clients: { name: string } | null } | null)?.clients?.name ??
                      (inv.jobs as unknown as { name: string } | null)?.name ??
                      "—"}{" "}
                    · Vencido em {formatDate(inv.due_date)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-destructive shrink-0 ml-3">
                  {formatCurrency(inv.total, inv.currency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
