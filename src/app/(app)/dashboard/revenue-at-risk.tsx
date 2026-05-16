"use client"

import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { differenceInDays, parseISO } from "date-fns"

export interface StaleJobInput {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  currency: string
  clients: { name: string } | null
}

export interface RecentDailyLog {
  date: string
  jobs: { id: string; name: string } | null
}

export interface RevenueAtRiskProps {
  overdueInvoices: {
    id: string
    total: number
    currency: string
  }[]
  activeJobs: StaleJobInput[]
  recentDailyLogs: RecentDailyLog[]
}

interface StaleJob {
  id: string
  name: string
  clientName: string
  rate: string
  daysSinceLastLog: number
}

function computeStaleJobs(
  activeJobs: StaleJobInput[],
  recentDailyLogs: RecentDailyLog[],
): StaleJob[] {
  const jobLastLogDate = new Map<string, string>()
  for (const log of recentDailyLogs) {
    const jobId = (log.jobs as unknown as { id: string } | null)?.id
    if (!jobId) continue
    const existing = jobLastLogDate.get(jobId)
    if (!existing || log.date > existing) {
      jobLastLogDate.set(jobId, log.date)
    }
  }

  const now = new Date()
  const stale: StaleJob[] = []

  for (const job of activeJobs) {
    const lastDate = jobLastLogDate.get(job.id)
    const daysSince = lastDate
      ? differenceInDays(now, parseISO(lastDate))
      : 14

    if (daysSince >= 14) {
      const clientName = (job.clients as unknown as { name: string } | null)?.name ?? "—"
      const rate = job.daily_rate > 0
        ? `${formatCurrency(job.daily_rate, job.currency)}/dia`
        : job.hourly_rate > 0
          ? `${formatCurrency(job.hourly_rate, job.currency)}/h`
          : "—"

      stale.push({
        id: job.id,
        name: job.name,
        clientName,
        rate,
        daysSinceLastLog: daysSince,
      })
    }
  }

  return stale.sort((a, b) => b.daysSinceLastLog - a.daysSinceLastLog)
}

export function RevenueAtRisk({
  overdueInvoices,
  activeJobs,
  recentDailyLogs,
}: RevenueAtRiskProps) {
  const staleJobs = computeStaleJobs(activeJobs, recentDailyLogs)

  const invoiceByCurrency = new Map<string, number>()
  for (const inv of overdueInvoices) {
    invoiceByCurrency.set(
      inv.currency,
      (invoiceByCurrency.get(inv.currency) ?? 0) + inv.total,
    )
  }

  const hasRisk = overdueInvoices.length > 0 || staleJobs.length > 0

  if (!hasRisk) {
    return (
      <Card className="border-green-200 dark:border-green-900">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">
              Nenhum invoice vencido e todos os jobs ativos com atividade recente.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <CardTitle className="text-base">Receita em risco</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoiceByCurrency.size > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Invoices vencidos</p>
            <div className="flex flex-wrap gap-3">
              {Array.from(invoiceByCurrency.entries()).map(([currency, total]) => (
                <span
                  key={currency}
                  className="text-lg font-bold text-destructive"
                >
                  {formatCurrency(total, currency)}
                </span>
              ))}
            </div>
          </div>
        )}

        {staleJobs.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Jobs sem atividade recente</p>
            <div className="space-y-2">
              {staleJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{job.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.clientName} · {job.rate}
                    </p>
                  </div>
                  <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0 ml-3">
                    {job.daysSinceLastLog}d sem log
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
