/**
 * The lines of an invoice when none were stored. An invoice created before items were
 * itemized — or whose job logs days instead of money — still owes the client the worked
 * days, so they are rebuilt here from the job's daily logs, exactly as the create dialog
 * stores them. A fixed-price project lists its worked days at no charge and then one line
 * at its closed price.
 */
import { HOURS_PER_DAY, type BillingUnit } from "@/lib/invoice-i18n"
import type { BillingMode } from "@/lib/billing-mode"

export interface SynthesizedItem {
  date: string
  description?: string | null
  hours_billed: number
  quantity: number
  unit: BillingUnit
  rate: number
  subtotal: number
}

/**
 * A day listed on a fixed-price invoice for the record, not for money: the project line
 * carries the price. Manual lines keep their own amounts.
 */
export function isWorkedDayLine(
  item: { unit?: BillingUnit | null; is_manual?: boolean | null },
  billingMode: BillingMode | null | undefined,
): boolean {
  return billingMode === "fixed" && item.unit !== "project" && !item.is_manual
}

interface GroupableItem {
  date: string
  hours_billed: number
  subtotal: number
  quantity?: number | null
  unit?: BillingUnit | null
  is_manual?: boolean | null
}

/**
 * The worked days folded into one line, for an invoice that asks for it: the line opens on
 * the first day, carries the last as `date_end`, and sums the hours, the quantity and the
 * amount. A project's closed price and free lines stay as they are. Fewer than two days
 * leave nothing to fold.
 */
export function groupDayLines<T extends GroupableItem>(items: T[]): Array<T & { date_end?: string }> {
  const isDay = (i: T) => !i.is_manual && i.unit !== "project"
  const days = items.filter(isDay)
  if (days.length < 2) return items

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const sum = (f: (i: T) => number) => Number(days.reduce((s, i) => s + f(i), 0).toFixed(2))
  const quantities = days.every(i => i.quantity != null)
  const folded: T & { date_end?: string } = {
    ...sorted[0],
    date_end: sorted[sorted.length - 1].date,
    hours_billed: sum(i => i.hours_billed),
    subtotal: sum(i => i.subtotal),
    quantity: quantities ? sum(i => i.quantity ?? 0) : sorted[0].quantity,
  }

  const firstAt = items.findIndex(isDay)
  return [...items.slice(0, firstAt), folded, ...items.slice(firstAt).filter(i => !isDay(i))]
}

export function itemsFromLogs(
  logs: Array<{ date: string; hours_billed: number; total_value: number | null }>,
  job: {
    name: string
    billing_mode?: BillingMode | null
    hourly_rate?: number | null
    daily_rate?: number | null
    contract_value?: number | null
  },
  invoice: { period_end: string; subtotal: number; total_hours_billed?: number | null },
): SynthesizedItem[] {
  const mode = job.billing_mode ?? "hourly"

  if (mode === "fixed") {
    const value = job.contract_value ?? invoice.subtotal
    const days: SynthesizedItem[] = logs.map(l => ({
      date: l.date,
      hours_billed: l.hours_billed,
      quantity: l.hours_billed,
      unit: "hour",
      rate: 0,
      subtotal: 0,
    }))
    return [...days, {
      date: invoice.period_end,
      description: job.name,
      hours_billed: invoice.total_hours_billed ?? logs.reduce((s, l) => s + l.hours_billed, 0),
      quantity: 1, unit: "project", rate: value, subtotal: value,
    }]
  }

  const toDays = (hours: number) => Number((hours / HOURS_PER_DAY).toFixed(2))
  return logs.map(l => ({
    date: l.date,
    hours_billed: l.hours_billed,
    quantity: mode === "daily" ? toDays(l.hours_billed) : l.hours_billed,
    unit: (mode === "daily" ? "day" : "hour") as BillingUnit,
    rate: mode === "daily" ? (job.daily_rate ?? 0) : (job.hourly_rate ?? 0),
    subtotal: l.total_value ?? 0,
  }))
}
