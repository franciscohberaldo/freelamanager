import { describe, it, expect } from "vitest"
import { daysInSpan, missingDays, logForDay, logValuesForDate } from "@/lib/job-days"

describe("logValuesForDate", () => {
  it("charges the weekend rate for a daily log created on Saturday", () => {
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 600, weekend_daily_rate: 900 }

    expect(logValuesForDate(job, "2026-11-07", 8, 8)).toEqual({
      daily_rate: 900,
      hours_worked: 8,
      hours_billed: 8,
      total_value: 900,
    })
  })
})

describe("daysInSpan", () => {
  it("lists the weekdays of a span, skipping the weekend", () => {
    // 2026-07-27 is a Monday; 2026-08-04 a Tuesday
    expect(daysInSpan("2026-07-27", "2026-08-04")).toEqual([
      "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31",
      "2026-08-03", "2026-08-04",
    ])
  })

  it("keeps Saturday and Sunday when asked", () => {
    expect(daysInSpan("2026-07-31", "2026-08-02", true)).toEqual(["2026-07-31", "2026-08-01", "2026-08-02"])
  })

  it("is a single day when start and end match", () => {
    expect(daysInSpan("2026-07-29", "2026-07-29")).toEqual(["2026-07-29"])
  })

  it("is empty when the end comes before the start", () => {
    expect(daysInSpan("2026-08-04", "2026-07-27")).toEqual([])
  })
})

describe("missingDays", () => {
  const job = { id: "j", start_date: "2026-07-27", end_date: "2026-07-31" }

  it("leaves out days that already have a log", () => {
    expect(missingDays(job, ["2026-07-28", "2026-07-30"])).toEqual(["2026-07-27", "2026-07-29", "2026-07-31"])
  })

  it("is empty without both dates", () => {
    expect(missingDays({ id: "j", start_date: "2026-07-27", end_date: null }, [])).toEqual([])
  })
})

describe("logForDay", () => {
  it("bills eight hours at the hourly rate", () => {
    expect(logForDay({ id: "j", billing_mode: "hourly", hourly_rate: 50 }, "2026-07-27", "u"))
      .toMatchObject({ user_id: "u", job_id: "j", date: "2026-07-27", hours_worked: 8, hours_billed: 8, total_value: 400 })
  })

  it("is worth one day's rate on a daily job", () => {
    expect(logForDay({ id: "j", billing_mode: "daily", daily_rate: 620 }, "2026-07-27", "u"))
      .toMatchObject({ daily_rate: 620, hours_billed: 8, total_value: 620 })
  })

  it("carries time but no money on a fixed-price project", () => {
    expect(logForDay({ id: "j", billing_mode: "fixed", hourly_rate: 50 }, "2026-07-27", "u"))
      .toMatchObject({ hours_billed: 8, total_value: 0 })
  })

  it("uses the normal rate on weekends when no weekend rate is set", () => {
    // 2026-08-01 is a Saturday
    expect(logForDay({ id: "j", billing_mode: "daily", daily_rate: 620 }, "2026-08-01", "u"))
      .toMatchObject({ daily_rate: 620, total_value: 620 })
  })

  it("charges the weekend rate on Saturday and Sunday when the job has one", () => {
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 620, weekend_daily_rate: 800 }
    expect(logForDay(job, "2026-08-01", "u")).toMatchObject({ daily_rate: 800, total_value: 800 })
    expect(logForDay(job, "2026-08-02", "u")).toMatchObject({ daily_rate: 800, total_value: 800 })
  })

  it("keeps the normal rate on weekdays even with a weekend rate set", () => {
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 620, weekend_daily_rate: 800 }
    expect(logForDay(job, "2026-07-31", "u")).toMatchObject({ daily_rate: 620, total_value: 620 })
  })

  it("charges the holiday rate on a weekday holiday", () => {
    // 2026-12-25 is a Friday
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 620, weekend_daily_rate: 800, holiday_daily_rate: 1000 }
    expect(logForDay(job, "2026-12-25", "u")).toMatchObject({ daily_rate: 1000, total_value: 1000 })
  })

  it("lets the holiday rate win when the holiday falls on a weekend", () => {
    // 2026-11-15 is a Sunday
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 620, weekend_daily_rate: 800, holiday_daily_rate: 1000 }
    expect(logForDay(job, "2026-11-15", "u")).toMatchObject({ daily_rate: 1000, total_value: 1000 })
  })

  it("falls back to the weekend or normal rate on holidays without a holiday rate", () => {
    // 2026-12-25 is a Friday; 2026-11-15 is a Sunday
    const job = { id: "j", billing_mode: "daily" as const, daily_rate: 620, weekend_daily_rate: 800 }
    expect(logForDay(job, "2026-12-25", "u")).toMatchObject({ daily_rate: 620, total_value: 620 })
    expect(logForDay(job, "2026-11-15", "u")).toMatchObject({ daily_rate: 800, total_value: 800 })
  })
})
