import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardCharts } from "./dashboard-charts"
import { startOfMonth, endOfMonth, format } from "date-fns"
import {
  TrendingUp, Clock, FileText, Briefcase, AlertCircle, CheckCircle2,
} from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd")
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd")

  const [
    { data: monthLogs },
    { data: activeJobs },
    { data: recentInvoices },
    { data: upcomingEvents },
    { data: allMonthlyData },
  ] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("hours_worked, hours_billed, total_value")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("jobs")
      .select("id, name, hourly_rate, currency, clients(name)")
      .eq("user_id", user!.id)
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, currency, status, period_start, period_end, jobs(name)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("agenda_events")
      .select("id, title, type, event_date, is_done, jobs(name)")
      .eq("user_id", user!.id)
      .eq("is_done", false)
      .gte("event_date", format(now, "yyyy-MM-dd"))
      .order("event_date")
      .limit(5),
    supabase
      .from("daily_logs")
      .select("date, total_value, hours_billed")
      .eq("user_id", user!.id)
      .order("date"),
  ])

  const totalBilledMonth = monthLogs?.reduce((sum, l) => sum + l.total_value, 0) ?? 0
  const totalHoursWorked = monthLogs?.reduce((sum, l) => sum + l.hours_worked, 0) ?? 0
  const totalHoursBilled = monthLogs?.reduce((sum, l) => sum + l.hours_billed, 0) ?? 0
  const pendingInvoices = recentInvoices?.filter(i => i.status === "sent").length ?? 0

  const invoiceStatusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" }> = {
    draft:    { label: "Rascunho", variant: "outline" },
    sent:     { label: "Enviado",  variant: "warning" },
    paid:     { label: "Pago",     variant: "success" },
    overdue:  { label: "Vencido",  variant: "destructive" },
  }

  const eventTypeIcons: Record<string, string> = {
    payment:   "💰",
    delivery:  "📦",
    meeting:   "🗣️",
    milestone: "🏆",
    deadline:  "⚠️",
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {format(now, "MMMM 'de' yyyy")} — visão geral do mês
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturado no mês</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalBilledMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalHoursBilled}h faturadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Horas trabalhadas</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalHoursWorked}h</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalHoursBilled > 0 && totalHoursWorked > 0
                ? `${((totalHoursBilled / totalHoursWorked) * 100).toFixed(0)}% faturado`
                : "Sem registros"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jobs ativos</CardTitle>
            <Briefcase className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeJobs?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">em andamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices pendentes</CardTitle>
            <FileText className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingInvoices}</p>
            <p className="text-xs text-muted-foreground mt-1">aguardando pagamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DashboardCharts logs={allMonthlyData ?? []} />

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum invoice ainda.</p>
            )}
            {recentInvoices?.map((inv) => {
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
            {upcomingEvents?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>
            )}
            {upcomingEvents?.map((ev) => (
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
