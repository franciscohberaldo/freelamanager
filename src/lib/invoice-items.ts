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
