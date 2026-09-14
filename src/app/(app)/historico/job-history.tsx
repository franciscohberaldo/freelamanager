"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, JOB_STATUS_LABELS } from "@/lib/utils"
import {
  summarizeJob, compareRows, BILLING_STATUS_LABELS,
  type BillingStatus, type HistoryInvoice, type SortKey, type JobSummary,
} from "@/lib/job-history"
import { ArrowDown, ArrowUp, ChevronsUpDown, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JobDialog } from "../jobs/job-dialog"
import type { Job } from "@/lib/supabase/types"

export type HistoryJob = Job & {
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

/** One NF reads as a date; several read as the months they span. */
function nfIssuedLabel(s: JobSummary) {
  if (!s.nfFrom || !s.nfTo) return "—"
  if (s.nfFrom === s.nfTo) return formatDate(s.nfFrom)
  return `${formatDate(s.nfFrom, "MM/yyyy")}–${formatDate(s.nfTo, "MM/yyyy")}`
}

const COLUMNS: { key: SortKey | null; label: string; align?: "right"; title?: string }[] = [
  { key: "tomador", label: "Tomador" },
  { key: "marca", label: "Marca" },
  { key: "job", label: "Job" },
  { key: "total", label: "Total", align: "right", title: "Ordena pelo número, sem converter moeda" },
  { key: "start", label: "Início" },
  { key: "end", label: "Fim" },
  { key: "nf", label: "Emissão NF" },
  { key: null, label: "Status do job" },
  { key: null, label: "Faturamento" },
  { key: null, label: "Invoices" },
  { key: null, label: "NFs" },
  { key: null, label: "" },
]

export function JobHistory({ jobs, clients }: { jobs: HistoryJob[]; clients: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("")
  const [client, setClient] = useState("all")
  const [billing, setBilling] = useState<"all" | BillingStatus>("all")
  const [year, setYear] = useState("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "start", dir: "desc" })

  const rows = useMemo(
    () => jobs.map(j => {
      const summary = summarizeJob(j.invoices ?? [], { start_date: j.start_date, end_date: j.end_date })
      return {
        job: j,
        summary,
        sortable: {
          tomador: tomador(j),
          marca: j.end_client ?? "",
          job: j.name,
          amount: summary.totals[0]?.amount ?? 0,
          start: summary.start,
          end: summary.end,
          nf: summary.nfFrom,
        },
      }
    }),
    [jobs],
  )

  const clientNames = useMemo(
    () => Array.from(new Set(jobs.map(j => j.clients?.name).filter((n): n is string => !!n))).sort(),
    [jobs],
  )
  const years = useMemo(
    () => Array.from(new Set(rows.map(r => r.summary.start?.slice(0, 4)).filter((y): y is string => !!y))).sort().reverse(),
    [rows],
  )

  const q = query.trim().toLowerCase()
  const visible = rows
    .filter(r => billing === "all" || r.summary.billing === billing)
    .filter(r => client === "all" || r.job.clients?.name === client)
    .filter(r => year === "all" || r.summary.start?.startsWith(year))
    .filter(r => !q || [r.job.name, tomador(r.job), r.job.end_client ?? ""].some(v => v.toLowerCase().includes(q)))
    .sort((a, b) => compareRows(a.sortable, b.sortable, sort.key, sort.dir))

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por job, marca ou tomador"
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
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} de {rows.length} jobs · clique no cabeçalho para ordenar
      </p>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {COLUMNS.map(c => (
                <th key={c.label} className={`p-2 ${c.align === "right" ? "text-right" : "text-left"}`} title={c.title}>
                  {c.key ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key!)}
                      className={`inline-flex items-center gap-1 hover:text-foreground ${sort.key === c.key ? "text-foreground font-medium" : ""}`}
                    >
                      {c.label}
                      {sort.key !== c.key ? <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        : sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ job, summary }) => (
              <tr key={job.id} className="border-t">
                <td className="p-2">
                  {tomador(job)}
                  {job.intermediary && <span className="text-muted-foreground"> · via {job.intermediary}</span>}
                </td>
                <td className="p-2">{job.end_client || <span className="text-muted-foreground">—</span>}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-7 rounded border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                      {job.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={job.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        : <ImageIcon className="w-3 h-3 text-muted-foreground/40" />}
                    </div>
                    <span>{job.name}</span>
                  </div>
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  {summary.totals.length === 0
                    ? "—"
                    : summary.totals.map(t => (
                        <div key={t.currency}>{formatCurrency(t.amount, t.currency)}</div>
                      ))}
                </td>
                <td className="p-2 whitespace-nowrap">{summary.start ? formatDate(summary.start) : "—"}</td>
                <td className="p-2 whitespace-nowrap">{summary.end ? formatDate(summary.end) : "—"}</td>
                <td className="p-2 whitespace-nowrap">{nfIssuedLabel(summary)}</td>
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
                <td className="p-2 text-right">
                  <JobDialog clients={clients} job={job} mode="edit">
                    <Button variant="ghost" size="sm">Editar</Button>
                  </JobDialog>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="p-6 text-center text-muted-foreground">Nenhum job nesse filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
