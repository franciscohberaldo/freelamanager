/**
 * A job that runs from a start date to an end date was worked on those days. This turns
 * the span into daily logs — one per day, weekdays by default — so the calendar's job bar
 * and the job's own list of days agree, and an invoice has days to list.
 */
import { addDays, format, isWeekend, parseISO } from "date-fns"
import { HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { isHoliday } from "@/lib/holidays"
import type { BillingMode } from "@/lib/billing-mode"

export interface SpanJob {
  id: string
  billing_mode?: BillingMode | null
  hourly_rate?: number | null
  daily_rate?: number | null
  /** Optional different rate for Saturday/Sunday; null or undefined means the normal rate. */
  weekend_daily_rate?: number | null
  /** Optional different rate for holidays; null or undefined means the weekend/normal rate. */
  holiday_daily_rate?: number | null
  start_date?: string | null
  end_date?: string | null
}

/**
 * The day rate that applies on a date. A holiday rate wins over everything, even when the
 * holiday falls on a weekend; then the weekend rate on Sat/Sun; otherwise the normal rate.
 */
export function dailyRateForDate(job: SpanJob, date: string): number {
  const normal = job.daily_rate ?? 0
  if (job.holiday_daily_rate != null && isHoliday(date)) return job.holiday_daily_rate
  if (job.weekend_daily_rate != null && isWeekend(parseISO(date))) return job.weekend_daily_rate
  return normal
}

/** Every date from start to end, inclusive; weekends only when asked. */
export function daysInSpan(start: string, end: string, includeWeekends = false): string[] {
  const out: string[] = []
  let cur = parseISO(start)
  const last = parseISO(end)
  if (cur > last) return out
  // A span longer than a year is a typo, not a job.
  for (let i = 0; i <= 366 && cur <= last; i++, cur = addDays(cur, 1)) {
    if (includeWeekends || !isWeekend(cur)) out.push(format(cur, "yyyy-MM-dd"))
  }
  return out
}

/** The span's days that have no log yet. */
export function missingDays(job: SpanJob, existing: string[], includeWeekends = false): string[] {
  if (!job.start_date || !job.end_date) return []
  const have = new Set(existing)
  return daysInSpan(job.start_date, job.end_date, includeWeekends).filter(d => !have.has(d))
}

/** Values for a log on a specific date, including the applicable daily rate. */
export function logValuesForDate(job: SpanJob, date: string, hoursWorked: number, hoursBilled: number) {
  const mode = job.billing_mode ?? "hourly"
  const dailyRate = dailyRateForDate(job, date)
  const total =
    mode === "fixed"  ? 0 :
    mode === "daily"  ? (hoursBilled / HOURS_PER_DAY) * dailyRate :
    hoursBilled * (job.hourly_rate ?? 0)
  return {
    daily_rate: dailyRate,
    hours_worked: hoursWorked,
    hours_billed: hoursBilled,
    total_value: Number(total.toFixed(2)),
  }
}

/**
 * A full day on this job: eight hours worked and billed; worth a day's rate on a daily
 * job, eight hours on an hourly one, nothing on a fixed-price project.
 */
export function logForDay(job: SpanJob, date: string, userId: string) {
  return {
    user_id: userId,
    job_id: job.id,
    date,
    meetings: null,
    requests: null,
    ...logValuesForDate(job, date, HOURS_PER_DAY, HOURS_PER_DAY),
  }
}
