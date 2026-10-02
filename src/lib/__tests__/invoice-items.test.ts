import { describe, it, expect } from "vitest"
import { itemsFromLogs, isWorkedDayLine, groupDayLines } from "@/lib/invoice-items"

const logs = [
  { date: "2026-04-27", hours_billed: 8, total_value: 500 },
  { date: "2026-04-28", hours_billed: 4, total_value: 250 },
]

describe("itemsFromLogs", () => {
  it("lists each worked day when the job bills by day", () => {
    const items = itemsFromLogs(logs, { name: "Motion Design", billing_mode: "daily", daily_rate: 62.5 }, { period_end: "2026-04-30", subtotal: 750 })
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ date: "2026-04-27", quantity: 1, unit: "day", rate: 62.5, subtotal: 500 })
    expect(items[1]).toMatchObject({ date: "2026-04-28", quantity: 0.5, unit: "day", subtotal: 250 })
  })

  it("lists each log in hours when the job bills by hour", () => {
    const items = itemsFromLogs(logs, { name: "Motion Design", billing_mode: "hourly", hourly_rate: 62.5 }, { period_end: "2026-04-30", subtotal: 750 })
    expect(items[0]).toMatchObject({ quantity: 8, unit: "hour", rate: 62.5 })
  })

  it("lists the worked days at no charge and then the closed price of a fixed project", () => {
    const items = itemsFromLogs(logs, { name: "Site", billing_mode: "fixed", contract_value: 17250 }, { period_end: "2026-04-30", subtotal: 17250, total_hours_billed: 12 })
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ date: "2026-04-27", quantity: 8, unit: "hour", rate: 0, subtotal: 0 })
    expect(items[1]).toMatchObject({ date: "2026-04-28", quantity: 4, unit: "hour", rate: 0, subtotal: 0 })
    expect(items[2]).toMatchObject({ description: "Site", quantity: 1, unit: "project", rate: 17250, subtotal: 17250, hours_billed: 12 })
  })

  it("falls back to the invoice subtotal when the project price is missing", () => {
    const items = itemsFromLogs([], { name: "Site", billing_mode: "fixed", contract_value: null }, { period_end: "2026-04-30", subtotal: 900 })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ rate: 900, subtotal: 900 })
  })

  it("tells a listed day from the priced line of a fixed project", () => {
    expect(isWorkedDayLine({ unit: "hour" }, "fixed")).toBe(true)
    expect(isWorkedDayLine({ unit: "project" }, "fixed")).toBe(false)
    expect(isWorkedDayLine({ unit: "hour", is_manual: true }, "fixed")).toBe(false)
    expect(isWorkedDayLine({ unit: "hour" }, "hourly")).toBe(false)
  })

  it("returns nothing for a daily job with no logs", () => {
    expect(itemsFromLogs([], { name: "X", billing_mode: "daily", daily_rate: 100 }, { period_end: "2026-04-30", subtotal: 0 })).toEqual([])
  })
})

describe("groupDayLines", () => {
  const day = (date: string, hours: number, subtotal: number) =>
    ({ date, hours_billed: hours, quantity: hours / 8, unit: "day" as const, subtotal, is_manual: false })

  it("folds the worked days into one line spanning them, summing hours, days and money", () => {
    const out = groupDayLines([day("2026-10-02", 8, 500), day("2026-10-01", 8, 500), day("2026-10-05", 4, 250)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ date: "2026-10-01", date_end: "2026-10-05", hours_billed: 20, quantity: 2.5, subtotal: 1250 })
  })

  it("keeps a project's closed price and free lines apart from the fold", () => {
    const project = { date: "2026-10-30", hours_billed: 16, quantity: 1, unit: "project" as const, subtotal: 900, is_manual: false }
    const free = { date: "2026-10-30", hours_billed: 0, quantity: 1, unit: "hour" as const, subtotal: 50, is_manual: true }
    const out = groupDayLines([day("2026-10-01", 8, 0), day("2026-10-02", 8, 0), project, free])
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ date_end: "2026-10-02", hours_billed: 16 })
    expect(out[1]).toBe(project)
    expect(out[2]).toBe(free)
  })

  it("leaves a single day alone", () => {
    const items = [day("2026-10-01", 8, 500)]
    expect(groupDayLines(items)).toBe(items)
  })
})
