/**
 * How a job is charged. Hourly and daily multiply a rate by what was logged; a project is
 * a closed price, agreed once, however many hours it ends up taking. Hours are still
 * logged against a project — they just do not turn into money.
 */
export const BILLING_MODES = ["hourly", "daily", "fixed"] as const

export type BillingMode = (typeof BILLING_MODES)[number]

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  hourly: "Por hora",
  daily:  "Por dia",
  fixed:  "Por projeto",
}

export function isBillingMode(value: string): value is BillingMode {
  return (BILLING_MODES as readonly string[]).includes(value)
}

/** The number that matters for this job: its rate, or the closed price of the project. */
export function rateOf(job: {
  billing_mode?: BillingMode | null
  hourly_rate?: number | null
  daily_rate?: number | null
  contract_value?: number | null
}): number {
  if (job.billing_mode === "fixed") return job.contract_value ?? 0
  if (job.billing_mode === "daily") return job.daily_rate ?? 0
  return job.hourly_rate ?? 0
}

/** What follows the amount when it is shown: "R$ 150/h", "R$ 8.000 · projeto". */
export function rateLabel(mode?: BillingMode | null): string {
  if (mode === "fixed") return " · projeto"
  if (mode === "daily") return "/dia"
  return "/h"
}

/** A project is billed once, so logged hours are tracked but carry no value. */
export function logValue(mode: BillingMode | null | undefined, hoursBilled: number, rate: number): number {
  return mode === "fixed" ? 0 : hoursBilled * rate
}
