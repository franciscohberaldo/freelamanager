"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, JOB_STATUS_LABELS } from "@/lib/utils"
import { summarizeJob, BILLING_STATUS_LABELS, type BillingStatus, type HistoryInvoice } from "@/lib/job-history"

export interface HistoryJob {
  id: string
  name: string
  status: string
  end_client: string | null
  intermediary: string | null
  clients: { name: string; legal_name: string | null } | null
  invoices: HistoryInvoice[]
}

const jobStatusVariant: Record<string, "default" | "success" | "warning" | "outline"> = {
  proposal: "outline", active: "success", paused: "warning", completed: "default",
}

const billingVariant: Record<BillingStatus, "outline" | "warning" | "success"> = {
  no_invoice: "outline", receivable: "warning", received: "success",
}

const tomador = (j: HistoryJob) => j.clients?.legal_name ?? j.clients?.name ?? "—"

export function JobHistory({ jobs }: { jobs: HistoryJob[] }) {
  const [query, setQuery] = useState("")
  const [client, setClient] = useState("all")
  const [billing, setBilling] = useState<"all" | BillingStatus>("all")

  const rows = useMemo(
    () => jobs.map(j => ({ job: j, summary: summarizeJob(j.invoices ?? []) })),
    [jobs],
  )

  const clientNames = useMemo(
    () => Array.from(new Set(jobs.map(j => j.clients?.name).filter((n): n is string => !!n))).sort(),
    [jobs],
  )

  const q = query.trim().toLowerCase()
  const visible = rows
    .filter(r => billing === "all" || r.summary.billing === billing)
    .filter(r => client === "all" || r.job.clients?.name === client)
    .filter(r => !q || r.job.name.toLowerCase().includes(q) || tomador(r.job).toLowerCase().includes(q))

  return (
    <div className="space-y-4 mt-2">
      <div className="flex gap-2 flex-wrap">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por job ou tomador"
          className="w-64"
        />
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tomadores</SelectItem>
            {clientNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={billing} onValueChange={v => setBilling(v as typeof billing)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo faturamento</SelectItem>
            {(Object.keys(BILLING_STATUS_LABELS) as BillingStatus[]).map(b => (
              <SelectItem key={b} value={b}>{BILLING_STATUS_LABELS[b]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-2">Tomador</th>
              <th className="text-left p-2">Job</th>
              <th className="text-right p-2">Total</th>
              <th className="text-left p-2">Status do job</th>
              <th className="text-left p-2">Faturamento</th>
              <th className="text-left p-2">Invoices</th>
              <th className="text-left p-2">NFs</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ job, summary }) => (
              <tr key={job.id} className="border-t">
                <td className="p-2">
                  {tomador(job)}
                  {job.intermediary && <span className="text-muted-foreground"> · via {job.intermediary}</span>}
                  {job.end_client && <span className="text-muted-foreground"> · {job.end_client}</span>}
                </td>
                <td className="p-2">{job.name}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {summary.totals.length === 0
                    ? "—"
                    : summary.totals.map(t => (
                        <div key={t.currency}>{formatCurrency(t.amount, t.currency)}</div>
                      ))}
                </td>
                <td className="p-2">
                  <Badge variant={jobStatusVariant[job.status] ?? "outline"}>
                    {JOB_STATUS_LABELS[job.status] ?? job.status}
                  </Badge>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <Badge variant={billingVariant[summary.billing]}>{BILLING_STATUS_LABELS[summary.billing]}</Badge>
                  {summary.nfPending && <span className="ml-1 text-xs text-amber-600">NF pendente</span>}
                </td>
                <td className="p-2 font-mono">{summary.invoiceLabel}</td>
                <td className="p-2 font-mono">{summary.nfLabel}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum job nesse filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
