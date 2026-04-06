"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportsCharts } from "./reports-charts"
import { ProductivityHeatmap } from "./heatmap"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MonthData {
  month: string; faturado: number; horasTrabalhadas: number; horasFaturadas: number; despesas?: number
}

interface JobRentabilidade {
  id: string; name: string; clientName: string; status: string; currency: string
  hourlyRate: number; contractValue: number | null
  horasWorked: number; horasBilled: number; faturado: number
}

interface ClientLTV {
  id: string; name: string; company: string | null
  totalRevenue: number; jobCount: number; invoiceCount: number
  firstDate: string | null; lastDate: string | null
  ticketMedio: number; last3: number; prev3: number
}

interface Props {
  year: number
  monthly: MonthData[]
  byJob: { name: string; faturado: number; horas: number; currency: string }[]
  expByCategory: Record<string, number>
  totalFaturado: number; totalDespesas: number; totalHorasFaturadas: number
  jobs: JobRentabilidade[]
  clients: ClientLTV[]
  logs: { date: string; hours_worked: number }[]
}

const catLabels: Record<string, string> = {
  software: "Software/SaaS", hardware: "Hardware", curso: "Educação",
  imposto: "Imposto/Contador", servico: "Serviço", outro: "Outro",
}

export function ReportsClient({
  year, monthly, byJob, expByCategory, totalFaturado, totalDespesas, totalHorasFaturadas,
  jobs, clients, logs,
}: Props) {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        <TabsTrigger value="rentabilidade">Rentabilidade</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
        <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
      </TabsList>

      {/* ===== OVERVIEW ===== */}
      <TabsContent value="overview" className="space-y-6">
        <ReportsCharts monthly={monthly} />

        {byJob.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Faturamento por Job</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {byJob.map(job => {
                  const pct = totalFaturado > 0 ? (job.faturado / totalFaturado) * 100 : 0
                  return (
                    <div key={job.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{job.name}</span>
                        <span>{formatCurrency(job.faturado, job.currency)} · {job.horas.toFixed(1)}h</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {totalDespesas > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                  const pct = totalDespesas > 0 ? (val / totalDespesas) * 100 : 0
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{catLabels[cat] ?? cat}</span>
                        <span className="text-destructive">{formatCurrency(val)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ===== RENTABILIDADE ===== */}
      <TabsContent value="rentabilidade" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rentabilidade por Job — {year}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                Nenhum job com registros neste ano.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Job</th>
                      <th className="text-right px-4 py-2.5 font-medium">H. Trabalhadas</th>
                      <th className="text-right px-4 py-2.5 font-medium">H. Faturadas</th>
                      <th className="text-right px-4 py-2.5 font-medium">Eficiência</th>
                      <th className="text-right px-4 py-2.5 font-medium">Custo Real*</th>
                      <th className="text-right px-4 py-2.5 font-medium">Faturado</th>
                      <th className="text-right px-4 py-2.5 font-medium">Margem</th>
                      {jobs.some(j => j.contractValue) && (
                        <th className="text-right px-4 py-2.5 font-medium">Contrato</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.filter(j => j.horasWorked > 0 || j.faturado > 0).sort((a, b) => b.faturado - a.faturado).map(job => {
                      const eficiencia = job.horasWorked > 0
                        ? ((job.horasBilled / job.horasWorked) * 100).toFixed(0)
                        : "—"
                      const custoReal = job.horasWorked * job.hourlyRate
                      const margem = custoReal > 0 ? ((job.faturado - custoReal) / custoReal * 100) : null
                      const margemPct = margem !== null ? margem.toFixed(0) : "—"
                      const hasContract = !!job.contractValue

                      return (
                        <tr key={job.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <p className="font-medium">{job.name}</p>
                            {job.clientName && (
                              <p className="text-xs text-muted-foreground">{job.clientName}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {job.horasWorked.toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {job.horasBilled.toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            <span className={parseInt(eficiencia) >= 80 ? "text-green-600" : parseInt(eficiencia) >= 50 ? "text-amber-600" : "text-destructive"}>
                              {eficiencia}{eficiencia !== "—" ? "%" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(custoReal, job.currency)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatCurrency(job.faturado, job.currency)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {margem !== null ? (
                              <span className={margem >= 0 ? "text-green-600" : "text-destructive"}>
                                {margem >= 0 ? "+" : ""}{margemPct}%
                              </span>
                            ) : "—"}
                          </td>
                          {jobs.some(j => j.contractValue) && (
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                              {hasContract ? formatCurrency(job.contractValue!, job.currency) : "—"}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground px-1">
          * Custo real = horas trabalhadas × taxa horária do job. Margem = (faturado − custo real) / custo real.
        </p>
      </TabsContent>

      {/* ===== CLIENTES ===== */}
      <TabsContent value="clientes" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">LTV & Ticket Médio por Cliente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clients.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                Nenhum dado de clientes encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                      <th className="text-right px-4 py-2.5 font-medium">LTV Total</th>
                      <th className="text-right px-4 py-2.5 font-medium">Jobs</th>
                      <th className="text-right px-4 py-2.5 font-medium">Invoices</th>
                      <th className="text-right px-4 py-2.5 font-medium">Ticket Médio</th>
                      <th className="text-center px-4 py-2.5 font-medium">Tendência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.sort((a, b) => b.totalRevenue - a.totalRevenue).map(cl => {
                      const trend = cl.last3 - cl.prev3
                      const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
                      const trendColor = trend > 0 ? "text-green-600" : trend < 0 ? "text-destructive" : "text-muted-foreground"
                      return (
                        <tr key={cl.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <p className="font-medium">{cl.name}</p>
                            {cl.company && <p className="text-xs text-muted-foreground">{cl.company}</p>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatCurrency(cl.totalRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {cl.jobCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {cl.invoiceCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {cl.invoiceCount > 0 ? formatCurrency(cl.ticketMedio) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                              {trend !== 0 && (
                                <span className={`text-xs ${trendColor}`}>
                                  {trend > 0 ? "+" : ""}{formatCurrency(Math.abs(trend))}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground px-1">
          LTV calculado com base em todos os invoices pagos. Tendência compara os últimos 3 meses com os 3 anteriores.
        </p>
      </TabsContent>

      {/* ===== PRODUTIVIDADE ===== */}
      <TabsContent value="produtividade" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas trabalhadas — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductivityHeatmap logs={logs} year={year} />
          </CardContent>
        </Card>

        {/* Monthly distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição mensal de horas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthly.filter(m => m.horasTrabalhadas > 0).map(m => {
                const maxH = Math.max(...monthly.map(x => x.horasTrabalhadas), 1)
                const pct  = (m.horasTrabalhadas / maxH) * 100
                const pctBilled = m.horasTrabalhadas > 0
                  ? ((m.horasFaturadas / m.horasTrabalhadas) * 100).toFixed(0)
                  : "0"
                return (
                  <div key={m.month}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium capitalize">{m.month}</span>
                      <span className="text-muted-foreground">
                        {m.horasTrabalhadas.toFixed(1)}h trab · {m.horasFaturadas.toFixed(1)}h fat · {pctBilled}% ef.
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      <div className="h-full bg-blue-400/40 rounded-full absolute top-0 left-0 transition-all"
                        style={{ width: `${pct}%` }} />
                      <div className="h-full bg-blue-600 rounded-full absolute top-0 left-0 transition-all"
                        style={{ width: `${(m.horasFaturadas / Math.max(...monthly.map(x => x.horasTrabalhadas), 1)) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-400/40 inline-block" /> Trabalhadas</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-600 inline-block" /> Faturadas</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
