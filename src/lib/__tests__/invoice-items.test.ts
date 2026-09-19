import { describe, it, expect } from "vitest"
import { itemsFromLogs, isWorkedDayLine } from "@/lib/invoice-items"

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
