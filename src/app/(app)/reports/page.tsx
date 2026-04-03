import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportsCharts } from "./reports-charts"
import { format, startOfYear, endOfYear } from "date-fns"

export default async function ReportsPage({ searchParams }: { searchParams: { year?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const year = parseInt(searchParams.year ?? String(new Date().getFullYear()))
  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd")
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd")

  const [{ data: logs }, { data: invoices }, { data: jobs }] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("date, hours_worked, hours_billed, total_value, job_id")
      .eq("user_id", user!.id)
      .gte("date", yearStart)
      .lte("date", yearEnd),
    supabase
      .from("invoices")
      .select("total, currency, status, period_start, job_id")
      .eq("user_id", user!.id)
      .gte("period_start", yearStart)
      .lte("period_start", yearEnd),
    supabase
      .from("jobs")
      .select("id, name, hourly_rate, currency")
      .eq("user_id", user!.id),
  ])

  const totalFaturado = logs?.reduce((s, l) => s + l.total_value, 0) ?? 0
  const totalHorasTrabalhadas = logs?.reduce((s, l) => s + l.hours_worked, 0) ?? 0
  const totalHorasFaturadas = logs?.reduce((s, l) => s + l.hours_billed, 0) ?? 0
  const totalInvoicesPagos = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0
  const eficiencia = totalHorasTrabalhadas > 0
    ? ((totalHorasFaturadas / totalHorasTrabalhadas) * 100).toFixed(1)
    : "0"

  // Monthly breakdown
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0")
    const key = `${year}-${month}`
    const monthLogs = logs?.filter((l) => l.date.startsWith(key)) ?? []
    return {
      month: new Date(year, i, 1).toLocaleString("pt-BR", { month: "short" }),
      faturado: monthLogs.reduce((s, l) => s + l.total_value, 0),
      horasTrabalhadas: monthLogs.reduce((s, l) => s + l.hours_worked, 0),
      horasFaturadas: monthLogs.reduce((s, l) => s + l.hours_billed, 0),
    }
  })

  // Per-job breakdown
  const byJob = jobs?.map((job) => {
    const jobLogs = logs?.filter((l) => l.job_id === job.id) ?? []
    return {
      name: job.name,
      faturado: jobLogs.reduce((s, l) => s + l.total_value, 0),
      horas: jobLogs.reduce((s, l) => s + l.hours_billed, 0),
      currency: job.currency,
    }
  }).filter(j => j.faturado > 0).sort((a, b) => b.faturado - a.faturado)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Visão anual — {year}</p>
        </div>
        <div className="flex gap-2">
          {[year - 1, year, year + 1].map((y) => (
            <a
              key={y}
              href={`/reports?year=${y}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                y === year
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {/* Annual KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total faturado</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalFaturado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Recebido (NFs pagas)</p>
            <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalInvoicesPagos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Horas faturadas</p>
            <p className="text-xl font-bold mt-1">{totalHorasFaturadas.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Eficiência de faturamento</p>
            <p className="text-xl font-bold mt-1">{eficiencia}%</p>
            <p className="text-xs text-muted-foreground">{totalHorasTrabalhadas.toFixed(1)}h trabalhadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <ReportsCharts monthly={monthly} />

      {/* Per job */}
      {byJob && byJob.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento por Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byJob.map((job) => {
                const pct = totalFaturado > 0 ? (job.faturado / totalFaturado) * 100 : 0
                return (
                  <div key={job.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{job.name}</span>
                      <span>{formatCurrency(job.faturado, job.currency)} · {job.horas.toFixed(1)}h</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
