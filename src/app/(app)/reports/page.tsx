import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { ReportsClient } from "./reports-client"
import { format, startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth } from "date-fns"

export default async function ReportsPage({ searchParams }: { searchParams: { year?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const year      = parseInt(searchParams.year ?? String(new Date().getFullYear()))
  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd")
  const yearEnd   = format(endOfYear(new Date(year, 0, 1)),   "yyyy-MM-dd")

  // Last 6 months for client trend
  const now = new Date()
  const trend3Start  = format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd")
  const trend3Mid    = format(startOfMonth(subMonths(now, 3)), "yyyy-MM-dd")
  const trendPrev3Start = format(startOfMonth(subMonths(now, 6)), "yyyy-MM-dd")

  const [
    { data: logs },
    { data: invoices },
    { data: jobs },
    { data: expenses },
    { data: allInvoices },
    { data: clients },
    { data: payments },
  ] = await Promise.all([
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
      .select("id, name, hourly_rate, currency, contract_value, clients(id, name, company)")
      .eq("user_id", user!.id),
    supabase
      .from("expenses")
      .select("date, amount, category")
      .eq("user_id", user!.id)
      .gte("date", yearStart)
      .lte("date", yearEnd),
    // All time invoices for LTV
    supabase
      .from("invoices")
      .select("total, status, period_start, job_id")
      .eq("user_id", user!.id),
    supabase
      .from("clients")
      .select("id, name, company")
      .eq("user_id", user!.id),
    // Payments received in the year (FX details for foreign-currency invoices)
    supabase
      .from("invoice_payments")
      .select("amount, paid_at, amount_received_brl, fees, exchange_rate")
      .eq("user_id", user!.id)
      .gte("paid_at", yearStart)
      .lte("paid_at", yearEnd),
  ])

  // ── Summary KPIs ──────────────────────────────────────────────────
  const totalFaturado         = logs?.reduce((s, l) => s + l.total_value, 0) ?? 0
  const totalHorasTrabalhadas = logs?.reduce((s, l) => s + l.hours_worked, 0) ?? 0
  const totalHorasFaturadas   = logs?.reduce((s, l) => s + l.hours_billed, 0) ?? 0
  const totalInvoicesPagos    = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0
  const totalDespesas         = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const fxPayments            = (payments ?? []).filter(p => p.amount_received_brl != null)
  const totalRecebidoBrlFx    = fxPayments.reduce((s, p) => s + (p.amount_received_brl ?? 0), 0)
  const avgExchangeRate       = fxPayments.length
    ? fxPayments.reduce((s, p) => s + (p.exchange_rate ?? 0), 0) / fxPayments.filter(p => p.exchange_rate).length || 0
    : 0
  const lucroLiquido          = totalFaturado - totalDespesas
  const eficiencia            = totalHorasTrabalhadas > 0
    ? ((totalHorasFaturadas / totalHorasTrabalhadas) * 100).toFixed(1)
    : "0"

  // ── Monthly data ──────────────────────────────────────────────────
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const month    = String(i + 1).padStart(2, "0")
    const key      = `${year}-${month}`
    const monthLogs = logs?.filter(l => l.date.startsWith(key)) ?? []
    const monthExp  = expenses?.filter(e => e.date.startsWith(key)) ?? []
    return {
      month:            new Date(year, i, 1).toLocaleString("pt-BR", { month: "short" }),
      faturado:         monthLogs.reduce((s, l) => s + l.total_value, 0),
      horasTrabalhadas: monthLogs.reduce((s, l) => s + l.hours_worked, 0),
      horasFaturadas:   monthLogs.reduce((s, l) => s + l.hours_billed, 0),
      despesas:         monthExp.reduce((s, e) => s + e.amount, 0),
    }
  })

  // ── Per-job summary ───────────────────────────────────────────────
  const byJob = jobs?.map(job => {
    const jobLogs = logs?.filter(l => l.job_id === job.id) ?? []
    return {
      name:     job.name,
      faturado: jobLogs.reduce((s, l) => s + l.total_value, 0),
      horas:    jobLogs.reduce((s, l) => s + l.hours_billed, 0),
      currency: job.currency,
    }
  }).filter(j => j.faturado > 0).sort((a, b) => b.faturado - a.faturado) ?? []

  // ── Expenses by category ─────────────────────────────────────────
  const expByCategory: Record<string, number> = {}
  expenses?.forEach(e => { expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount })

  // ── Rentabilidade por job ─────────────────────────────────────────
  const jobsRent = jobs?.map(job => {
    const jobLogs = logs?.filter(l => l.job_id === job.id) ?? []
    const client  = job.clients as unknown as { id: string; name: string; company: string | null } | null
    return {
      id:            job.id,
      name:          job.name,
      clientName:    client?.name ?? "",
      status:        "active",
      currency:      job.currency,
      hourlyRate:    job.hourly_rate,
      contractValue: job.contract_value ?? null,
      horasWorked:   jobLogs.reduce((s, l) => s + l.hours_worked, 0),
      horasBilled:   jobLogs.reduce((s, l) => s + l.hours_billed, 0),
      faturado:      jobLogs.reduce((s, l) => s + l.total_value, 0),
    }
  }) ?? []

  // ── Client LTV ────────────────────────────────────────────────────
  // Build jobId → clientId map
  const jobClientMap: Record<string, string> = {}
  jobs?.forEach(job => {
    const client = job.clients as unknown as { id: string } | null
    if (client) jobClientMap[job.id] = client.id
  })

  // Map clientId → job count
  const clientJobCount: Record<string, number> = {}
  jobs?.forEach(job => {
    const cid = jobClientMap[job.id]
    if (cid) clientJobCount[cid] = (clientJobCount[cid] ?? 0) + 1
  })

  const clientsLTV = clients?.map(cl => {
    const clInvoices = allInvoices?.filter(i => jobClientMap[i.job_id] === cl.id) ?? []
    const paidInvoices = clInvoices.filter(i => i.status === "paid")
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0)
    const ticketMedio  = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0
    const dates        = paidInvoices.map(i => i.period_start).sort()
    const firstDate    = dates[0] ?? null
    const lastDate     = dates[dates.length - 1] ?? null

    // Trend: last 3 months vs prev 3 months (by period_start)
    const last3 = paidInvoices
      .filter(i => i.period_start >= format(subMonths(now, 3), "yyyy-MM-dd"))
      .reduce((s, i) => s + i.total, 0)
    const prev3 = paidInvoices
      .filter(i => i.period_start >= format(subMonths(now, 6), "yyyy-MM-dd") && i.period_start < format(subMonths(now, 3), "yyyy-MM-dd"))
      .reduce((s, i) => s + i.total, 0)

    return {
      id:           cl.id,
      name:         cl.name,
      company:      cl.company,
      totalRevenue,
      jobCount:     clientJobCount[cl.id] ?? 0,
      invoiceCount: paidInvoices.length,
      firstDate,
      lastDate,
      ticketMedio,
      last3,
      prev3,
    }
  }).filter(c => c.totalRevenue > 0) ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Visão anual — {year}</p>
        </div>
        <div className="flex gap-2">
          {[year - 1, year, year + 1].map(y => (
            <a key={y} href={`/reports?year=${y}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                y === year
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}>
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
            <p className="text-xs text-muted-foreground">Despesas totais</p>
            <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Lucro líquido estimado</p>
            <p className={`text-xl font-bold mt-1 ${lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(lucroLiquido)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Recebido em BRL (câmbio)</p>
            <p className="text-xl font-bold mt-1 text-green-600">{fxPayments.length ? formatCurrency(totalRecebidoBrlFx) : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {fxPayments.length ? `${fxPayments.length} recebimento${fxPayments.length > 1 ? "s" : ""} internacional${fxPayments.length > 1 ? "is" : ""}${avgExchangeRate ? ` · câmbio médio ${avgExchangeRate.toFixed(2)}` : ""}` : "Nenhum recebimento internacional"}
            </p>
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
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Ticket médio/hora</p>
            <p className="text-xl font-bold mt-1">
              {totalHorasFaturadas > 0 ? formatCurrency(totalFaturado / totalHorasFaturadas) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Margem líquida</p>
            <p className={`text-xl font-bold mt-1 ${lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}`}>
              {totalFaturado > 0 ? `${((lucroLiquido / totalFaturado) * 100).toFixed(1)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed content */}
      <ReportsClient
        year={year}
        monthly={monthly}
        byJob={byJob}
        expByCategory={expByCategory}
        totalFaturado={totalFaturado}
        totalDespesas={totalDespesas}
        totalHorasFaturadas={totalHorasFaturadas}
        jobs={jobsRent}
        clients={clientsLTV}
        logs={(logs ?? []).map(l => ({ date: l.date, hours_worked: l.hours_worked }))}
      />
    </div>
  )
}
