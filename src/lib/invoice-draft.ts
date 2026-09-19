/**
 * The lines of an invoice before it exists. The create dialog and the live preview both
 * need the same answer to "what will this invoice contain?", so the answer lives here,
 * once: hourly and daily jobs bill each fresh log; a fixed-price project lists its days at
 * no charge and closes with one line at the contract value; free lines are added as typed.
 */
import { HOURS_PER_DAY, type BillingUnit } from "@/lib/invoice-i18n"
import { rateOf, type BillingMode } from "@/lib/billing-mode"

export interface DraftLog {
  id: string
  date: string
  hours_billed: number
  total_value: number
}

export interface DraftJob {
  name: string
  billing_mode?: BillingMode | null
  hourly_rate?: number | null
  daily_rate?: number | null
  contract_value?: number | null
}

export interface ManualLine {
  description: string
  job_number: string
  quantity: number
  rate: number
}

export interface DraftItem {
  log_id: string | null
  date: string
  description?: string | null
  job_number?: string | null
  hours_billed: number
  quantity: number
  unit: BillingUnit
  rate: number
  subtotal: number
  is_manual?: boolean
}

export interface Draft {
  items: DraftItem[]
  subtotal: number
  totalHours: number
}

const toDays = (hours: number) => Number((hours / HOURS_PER_DAY).toFixed(2))

/** Free lines worth keeping: something written, something to charge for. */
export function usableManualLines(lines: ManualLine[]): ManualLine[] {
  return lines.filter(l => l.description.trim() && l.quantity > 0)
}

export function buildDraft(
  logs: DraftLog[],
  job: DraftJob,
  manualLines: ManualLine[],
  periodEnd: string,
): Draft {
  const mode = job.billing_mode ?? "hourly"
  const totalHours = logs.reduce((s, l) => s + l.hours_billed, 0)

  let items: DraftItem[]
  let subtotal: number

  if (mode === "fixed") {
    const price = rateOf(job)
    items = [
      ...logs.map<DraftItem>(l => ({
        log_id: l.id, date: l.date, hours_billed: l.hours_billed,
        quantity: l.hours_billed, unit: "hour", rate: 0, subtotal: 0,
      })),
      {
        log_id: null, date: periodEnd, description: job.name, hours_billed: totalHours,
        quantity: 1, unit: "project", rate: price, subtotal: price,
      },
    ]
    subtotal = price
  } else {
    const daily = mode === "daily"
    items = logs.map<DraftItem>(l => ({
      log_id: l.id, date: l.date, hours_billed: l.hours_billed,
      quantity: daily ? toDays(l.hours_billed) : l.hours_billed,
      unit: daily ? "day" : "hour",
      rate: daily ? (job.daily_rate ?? 0) : (job.hourly_rate ?? 0),
      subtotal: l.total_value,
    }))
    subtotal = logs.reduce((s, l) => s + l.total_value, 0)
  }

  const manual = usableManualLines(manualLines).map<DraftItem>(l => ({
    log_id: null, date: periodEnd,
    description: l.description.trim(), job_number: l.job_number.trim() || null,
    hours_billed: 0, quantity: l.quantity, unit: "hour",
    rate: l.rate, subtotal: Number((l.quantity * l.rate).toFixed(2)), is_manual: true,
  }))

  return {
    items: [...items, ...manual],
    subtotal: subtotal + manual.reduce((s, m) => s + m.subtotal, 0),
    totalHours,
  }
}

/** Nothing to put on the page: no days, no free lines, and no closed price to fall back on. */
export function draftIsEmpty(draft: Draft, job: DraftJob): boolean {
  return draft.items.length === 0 && job.billing_mode !== "fixed"
}
