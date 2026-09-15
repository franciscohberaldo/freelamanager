"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate, JOB_STATUS_LABELS } from "@/lib/utils"
import { rateOf, rateLabel } from "@/lib/billing-mode"
import { workHoursInLocal } from "@/lib/timezone"
import {
  summarizeJob, compareRows, BILLING_STATUS_LABELS,
  type BillingStatus, type HistoryInvoice, type SortKey, type JobSummary,
} from "@/lib/job-history"
import { reorder, mergeColumnOrder } from "@/lib/column-order"
import {
  DOCUMENT_KINDS, DOCUMENT_LABELS, DOCUMENT_SHORT_LABELS, type DocumentKind,
} from "@/lib/job-documents"
import {
  ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, Image as ImageIcon,
  Mail, Paperclip, RotateCcw,
} from "lucide-react"
import { AttachedCheck, NotAttached } from "@/components/attached-check"
import { Button } from "@/components/ui/button"
import { NfRequestDialog } from "../invoices/nf-request-dialog"
import type { Job } from "@/lib/supabase/types"

export type HistoryJob = Job & {
  clients: { name: string; legal_name: string | null } | null
  job_documents: { kind: DocumentKind }[]
  invoices: (HistoryInvoice & { id?: string })[]
  /** Requests already sent to the accountant, newest first. */
  nf_requests?: { created_at: string; status: string }[]
}

const ORDER_STORAGE_KEY = "historico:column-order"

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

type Row = { job: HistoryJob; summary: JobSummary }

/**
 * `key` identifies the column across reorderings and saved orders; `sortKey` says whether
 * and by what it sorts. Keeping the two apart is what lets a column move without losing
 * its place in an order saved earlier.
 */
type Column = {
  key: string
  label: string
  sortKey?: SortKey
  align?: "right" | "center"
  nowrap?: boolean
  title?: string
  /** Marks a column as being about an attached file rather than a value. */
  icon?: React.ElementType
  cell: (row: Row) => React.ReactNode
}

const dash = <span className="text-muted-foreground">—</span>

/**
 * Two lines are enough to recognise a value, and a third pushes every row taller — the
 * full text stays in the tooltip. Used by the columns whose content is a name.
 */
function Clamped({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span className="line-clamp-2 max-w-[15rem]" title={title}>{children}</span>
  )
}

/**
 * The e-mail to the accountant, one click away from the job row. A request that went out
 * reads "Enviado" with its date — the dialog's own success toast is the approval message —
 * and can be sent again; a job never asked shows the button that opens the request dialog.
 * The row's own click opens the job, so the cell stops every click from bubbling up.
 */
function AccountantEmailCell({ job }: { job: HistoryJob }) {
  const [open, setOpen] = useState(false)
  const sent = (job.nf_requests ?? []).find(r => r.status !== "failed")

  return (
    <div onClick={e => e.stopPropagation()} className="flex items-center gap-1.5">
      {sent ? (
        <>
          <span className="space-y-0.5">
            <Badge variant="success" className="whitespace-nowrap">Enviado</Badge>
            <span className="block text-xs text-muted-foreground">{formatDate(sent.created_at)}</span>
          </span>
          <Button
            variant="ghost" size="sm" className="px-1.5"
            title="Enviar novamente"
            onClick={() => setOpen(true)}
          >
            <Mail className="w-3.5 h-3.5" />
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Mail className="w-3.5 h-3.5" />
          Enviar
        </Button>
      )}
      <NfRequestDialog jobId={job.id} open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

const BASE_COLUMNS: Column[] = [
  {
    key: "tomador", label: "Tomador", sortKey: "tomador",
    cell: ({ job }) => (
      <Clamped title={tomador(job) + (job.intermediary ? ` · via ${job.intermediary}` : "")}>
        {tomador(job)}
        {job.intermediary && <span className="text-muted-foreground"> · via {job.intermediary}</span>}
      </Clamped>
    ),
  },
  {
    key: "marca", label: "Marca", sortKey: "marca",
    cell: ({ job }) => job.end_client
      ? <Clamped title={job.end_client}>{job.end_client}</Clamped>
      : dash,
  },
  {
    key: "thumb", label: "Thumb",
    cell: ({ job }) => (
      <Link href={`/jobs/${job.id}`} className="w-10 h-7 rounded border bg-muted/40 overflow-hidden flex items-center justify-center">
        {job.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={job.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <ImageIcon className="w-3 h-3 text-muted-foreground/40" />}
      </Link>
    ),
  },
  {
    key: "job", label: "Job", sortKey: "job",
    cell: ({ job }) => (
      <Clamped title={job.name}>
        <Link href={`/jobs/${job.id}`} className="hover:underline">{job.name}</Link>
      </Clamped>
    ),
  },
  {
    key: "contract", label: "Contrato", sortKey: "contract", align: "right", nowrap: true,
    title: "Valor combinado no job, independente do que já foi faturado",
    cell: ({ job }) => job.contract_value == null
      ? dash
      : formatCurrency(job.contract_value, job.currency),
  },
  {
    key: "code", label: "Código",
    cell: ({ job }) => job.project_code
      ? <span className="font-mono text-xs">{job.project_code}</span>
      : dash,
  },
  {
    key: "rate", label: "Valor", sortKey: "rate", align: "right", nowrap: true,
    title: "Quanto o job cobra: por hora, por dia, ou o preço fechado do projeto",
    cell: ({ job }) => (
      <>
        {formatCurrency(rateOf(job), job.currency)}
        <span className="text-muted-foreground">{rateLabel(job.billing_mode)}</span>
      </>
    ),
  },
  {
    key: "total", label: "Total", sortKey: "total", align: "right", nowrap: true,
    title: "Ordena pelo número, sem converter moeda",
    cell: ({ summary }) => summary.totals.length === 0
      ? "—"
      : summary.totals.map(t => <div key={t.currency}>{formatCurrency(t.amount, t.currency)}</div>),
  },
  {
    key: "start", label: "Início", sortKey: "start", nowrap: true,
    cell: ({ summary }) => summary.start ? formatDate(summary.start) : "—",
  },
  {
    key: "end", label: "Fim", sortKey: "end", nowrap: true,
    cell: ({ summary }) => summary.end ? formatDate(summary.end) : "—",
  },
  {
    key: "hours", label: "Horário", nowrap: true,
    title: "Horário de trabalho do cliente, convertido para o seu fuso",
    cell: ({ job }) => {
      const h = workHoursInLocal(job.work_hours, job.timezone)
      return h ? <span title={`${h.remoteLabel} = ${h.localLabel}`}>{h.localLabel}</span> : dash
    },
  },
  {
    key: "nf_issued", label: "Emissão NF", sortKey: "nf", nowrap: true,
    cell: ({ summary }) => nfIssuedLabel(summary),
  },
  {
    key: "status", label: "Status do job",
    cell: ({ job }) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge variant={jobStatusVariant[job.status] ?? "outline"}>
          {JOB_STATUS_LABELS[job.status] ?? job.status}
        </Badge>
        {job.is_recurring && <Badge variant="outline">Recorrente</Badge>}
        {job.is_confidential && (
          <Badge variant="destructive" title="Confidencial: não divulgar o trabalho">NDA</Badge>
        )}
      </span>
    ),
  },
  {
    key: "billing", label: "Faturamento", nowrap: true,
    cell: ({ summary }) => (
      <>
        <Badge variant={billingVariant[summary.billing]}>{BILLING_STATUS_LABELS[summary.billing]}</Badge>
        {summary.nfPending && <span className="ml-1 text-xs text-amber-600">NF pendente</span>}
      </>
    ),
  },
  { key: "invoices", label: "Invoices", cell: ({ summary }) => <span className="font-mono">{summary.invoiceLabel}</span> },
  { key: "nfs", label: "NFs", cell: ({ summary }) => <span className="font-mono">{summary.nfLabel}</span> },
  {
    key: "contador", label: "Contador", nowrap: true,
    title: "E-mail de pedido de NF enviado ao contador",
    cell: ({ job }) => <AccountantEmailCell job={job} />,
  },
]

/**
 * Generated from DOCUMENT_KINDS so a kind added later becomes a column without anyone
 * having to remember this file. The paperclip separates these from the "Invoices" and
 * "NFs" columns above, which carry numbers rather than attachments.
 */
const DOCUMENT_COLUMNS: Column[] = DOCUMENT_KINDS.map(kind => ({
  key: `doc_${kind}`,
  label: DOCUMENT_SHORT_LABELS[kind],
  icon: Paperclip,
  align: "center" as const,
  title: kind === "accountant_email"
    ? "Pedido de NF enviado ao contador, ou o e-mail anexado à mão"
    : `Documento anexado: ${DOCUMENT_LABELS[kind]}`,
  cell: ({ job }: Row) => {
    const attached = (job.job_documents ?? []).some(d => d.kind === kind)
    // The accountant's slot is ticked by the request the system sent, not only by a file.
    const sent = kind === "accountant_email"
      ? (job.nf_requests ?? []).find(r => r.status !== "failed")
      : undefined
    if (!attached && !sent) return <NotAttached />
    return (
      <AttachedCheck
        title={sent ? `Pedido enviado em ${formatDate(sent.created_at)}` : undefined}
      />
    )
  },
}))

const COLUMNS = [...BASE_COLUMNS, ...DOCUMENT_COLUMNS]

const DEFAULT_ORDER = COLUMNS.map(c => c.key)

const alignClass = (align: Column["align"]) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

export function JobHistory({ jobs }: { jobs: HistoryJob[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [client, setClient] = useState("all")
  const [billing, setBilling] = useState<"all" | BillingStatus>("all")
  const [year, setYear] = useState("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "start", dir: "desc" })
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [dragging, setDragging] = useState<string | null>(null)

  // Read after mount: the server has no localStorage, so rendering a saved order on the
  // first pass would not match the markup it sent.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY)
      if (raw) setOrder(mergeColumnOrder(JSON.parse(raw), DEFAULT_ORDER))
    } catch {
      // a corrupt or unavailable store just means the default order
    }
  }, [])

  function saveOrder(next: string[]) {
    setOrder(next)
    try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function onDrop(targetKey: string) {
    if (dragging && dragging !== targetKey) {
      saveOrder(reorder(order, order.indexOf(dragging), order.indexOf(targetKey)))
    }
    setDragging(null)
  }

  function resetOrder() {
    setOrder(DEFAULT_ORDER)
    try { localStorage.removeItem(ORDER_STORAGE_KEY) } catch {}
  }

  const columns = useMemo(
    () => order.map(k => COLUMNS.find(c => c.key === k)).filter((c): c is Column => !!c),
    [order],
  )
  const reordered = order.join() !== DEFAULT_ORDER.join()

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
          contract: j.contract_value ?? 0,
          rate: rateOf(j),
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

  /** The whole row opens the job — except when the click was a drag to select text in a cell. */
  const openJob = (id: string) => {
    if (window.getSelection()?.toString()) return
    router.push(`/jobs/${id}`)
  }

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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

        {reordered && (
          <Button variant="ghost" size="sm" onClick={resetOrder} className="ml-auto">
            <RotateCcw className="w-3 h-3" />
            Restaurar ordem
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  draggable
                  onDragStart={() => setDragging(c.key)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDrop(c.key)}
                  onDragEnd={() => setDragging(null)}
                  title={c.title}
                  className={[
                    "group p-2 select-none cursor-grab active:cursor-grabbing",
                    alignClass(c.align),
                    dragging === c.key ? "opacity-40" : "",
                    dragging && dragging !== c.key ? "bg-accent/40" : "",
                  ].join(" ")}
                >
                  <span className={`inline-flex items-center gap-1 ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                    <GripVertical className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40" />
                    {c.icon && <c.icon className="w-3 h-3 shrink-0 opacity-50" />}
                    {c.sortKey ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.sortKey!)}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${sort.key === c.sortKey ? "text-foreground font-medium" : ""}`}
                      >
                        {c.label}
                        {sort.key !== c.sortKey ? <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          : sort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </button>
                    ) : c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr
                key={row.job.id}
                onClick={() => openJob(row.job.id)}
                className="border-t cursor-pointer hover:bg-muted/30"
              >
                {columns.map(c => (
                  <td
                    key={c.key}
                    className={`p-2 ${alignClass(c.align)} ${c.nowrap ? "whitespace-nowrap" : ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-muted-foreground">
                  Nenhum job nesse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
