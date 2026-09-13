import type { Invoice } from "@/lib/supabase/types"

export type HistoryInvoice = Pick<
  Invoice,
  "seq_number" | "invoice_number" | "nf_number" | "total" | "currency" | "status" | "nf_status"
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

export function summarizeJob(invoices: HistoryInvoice[]): JobSummary {
  const byCurrency = new Map<string, number>()
  for (const i of invoices) byCurrency.set(i.currency, (byCurrency.get(i.currency) ?? 0) + i.total)

  const billing: BillingStatus =
    invoices.length === 0 ? "no_invoice"
    : invoices.every(i => i.status === "paid") ? "received"
    : "receivable"

  const seqLabels = invoices.map(i => i.seq_number ?? `#${i.invoice_number}`)

  return {
    totals: Array.from(byCurrency, ([currency, amount]) => ({ currency, amount })),
    billing,
    nfPending: invoices.some(i => i.nf_status === "pending" || i.nf_status === "requested"),
    invoiceLabel: invoices.length > 3 ? `${invoices.length} invoices` : compactNumbers(seqLabels),
    nfLabel: compactNumbers(invoices.map(i => i.nf_number)),
  }
}
