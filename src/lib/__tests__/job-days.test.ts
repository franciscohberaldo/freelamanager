import { describe, it, expect } from "vitest"
import { daysInSpan, missingDays, logForDay } from "@/lib/job-days"

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
})
