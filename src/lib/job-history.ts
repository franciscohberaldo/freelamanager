import type { Invoice } from "@/lib/supabase/types"
import { formatNfNumber, effectiveNfSeries, NF_SERIES_CODES } from "@/lib/nf-status"
import { padSeq } from "@/lib/nf-sequence"

export type HistoryInvoice = Pick<
  Invoice,
  "seq_number" | "invoice_number" | "nf_number" | "nf_series" | "total" | "currency" | "status" | "nf_status"
  | "period_start" | "period_end" | "nf_issued_at"
>

export type BillingStatus = "no_invoice" | "receivable" | "received"

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  no_invoice: "Sem invoice",
  receivable: "A receber",
  received: "Recebido",
}

export interface JobSummary {
  totals: { currency: string; amount: number }[]
  billing: BillingStatus
  nfPending: boolean
  invoiceLabel: string
  nfLabel: string
  /** First day billed, from the invoices; the job's own start date when it has none. */
  start: string | null
  end: string | null
  /** Range of NF issue dates; equal ends mean a single NF. */
  nfFrom: string | null
  nfTo: string | null
}

export type SortKey = "tomador" | "marca" | "job" | "contract" | "rate" | "total" | "start" | "end" | "nf"

export interface SortableRow {
  tomador: string
  /** The brand served through the tomador; empty when not recorded yet. */
  marca: string
  job: string
  /** What the job was contracted for, apart from what has been invoiced. */
  contract: number
  /** The rate the job charges by — per hour, per day, or the closed project price. */
  rate: number
  amount: number
  start: string | null
  end: string | null
  nf: string | null
}

const minOf = (v: (string | null)[]) => v.filter(Boolean).sort()[0] ?? null
const maxOf = (v: (string | null)[]) => v.filter(Boolean).sort().at(-1) ?? null

/** Rows missing the value sort last, whichever direction is asked for. */
export function compareRows(a: SortableRow, b: SortableRow, key: SortKey, dir: "asc" | "desc"): number {
  const flip = dir === "asc" ? 1 : -1
  if (key === "total") return (a.amount - b.amount) * flip
  if (key === "contract") return (a.contract - b.contract) * flip
  if (key === "rate") return (a.rate - b.rate) * flip
  if (key === "tomador" || key === "job" || key === "marca") {
    // an unrecorded brand sorts last either way, like a missing date
    if (!a[key] && !b[key]) return 0
    if (!a[key]) return 1
    if (!b[key]) return -1
    return a[key].localeCompare(b[key], "pt-BR", { sensitivity: "base" }) * flip
  }
  const x = a[key], y = b[key]
  if (!x && !y) return 0
  if (!x) return 1
  if (!y) return -1
  return x.localeCompare(y) * flip
}

/** Up to three values listed, more than that collapsed into a low–high range. */
export function compactNumbers(values: (string | null)[]): string {
  const present = values.filter((v): v is string => v != null && v !== "")
  if (present.length === 0) return "—"
  if (present.length <= 3) return present.join(", ")
  const nums = present.map(v => parseInt(v.replace(/\D/g, ""), 10)).filter(Number.isInteger)
  if (nums.length === 0) return `${present.length} itens`
  return `${Math.min(...nums)}–${Math.max(...nums)}`
}

/**
 * NF labels for a job: each one formatted with its series code ("0030 PLN", "0015 SP").
 * Rows imported before `nf_series` existed get the series derived from the issue date.
 * More than three collapse into a padded range — "0028–0031 PLN" when they share one
 * series, "5 NFs" when they span both.
 */
export function compactNfLabels(
  invoices: Pick<Invoice, "nf_number" | "nf_series" | "nf_issued_at" | "period_start">[],
): string {
  const present = invoices.filter(i => i.nf_number)
  if (present.length === 0) return "—"
  const seriesOf = (i: (typeof present)[number]) => effectiveNfSeries(i.nf_series, i.nf_issued_at ?? i.period_start)
  if (present.length <= 3) return present.map(i => formatNfNumber(seriesOf(i), i.nf_number)).join(", ")
  const nums = present.map(i => parseInt(i.nf_number!.replace(/\D/g, ""), 10)).filter(Number.isInteger)
  if (nums.length === 0) return `${present.length} NFs`
  const seriesSet = new Set(present.map(seriesOf))
  // A range across two numbering sequences would be misleading — count instead.
  if (seriesSet.size > 1) return `${present.length} NFs`
  const range = `${padSeq(Math.min(...nums))}–${padSeq(Math.max(...nums))}`
  return `${range} ${NF_SERIES_CODES[present.map(seriesOf)[0]]}`
}

export function summarizeJob(
  invoices: HistoryInvoice[],
  fallback?: { start_date: string | null; end_date: string | null },
): JobSummary {
  const byCurrency = new Map<string, number>()
  for (const i of invoices) byCurrency.set(i.currency, (byCurrency.get(i.currency) ?? 0) + i.total)

  const billing: BillingStatus =
    invoices.length === 0 ? "no_invoice"
    : invoices.every(i => i.status === "paid") ? "received"
    : "receivable"

  const seqLabels = invoices.map(i => {
    const label = i.seq_number ?? `#${i.invoice_number}`
    const code = NF_SERIES_CODES[effectiveNfSeries(i.nf_series, i.nf_issued_at ?? i.period_start)]
    return `${label} ${code}`
  })

  const nfDates = invoices.map(i => i.nf_issued_at)

  return {
    totals: Array.from(byCurrency, ([currency, amount]) => ({ currency, amount })),
    start: invoices.length ? minOf(invoices.map(i => i.period_start)) : fallback?.start_date ?? null,
    end: invoices.length ? maxOf(invoices.map(i => i.period_end)) : fallback?.end_date ?? null,
    nfFrom: minOf(nfDates),
    nfTo: maxOf(nfDates),
    billing,
    nfPending: invoices.some(i => i.nf_status === "pending" || i.nf_status === "requested"),
    invoiceLabel: invoices.length > 3 ? `${invoices.length} invoices` : compactNumbers(seqLabels),
    nfLabel: compactNfLabels(invoices),
  }
}
