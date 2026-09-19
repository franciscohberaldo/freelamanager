import { describe, it, expect } from "vitest"
import { buildDraft, draftIsEmpty, usableManualLines } from "@/lib/invoice-draft"
import { invoiceLangFor } from "@/lib/invoice-i18n"

const logs = [
  { id: "a", date: "2026-09-02", hours_billed: 8, total_value: 400 },
  { id: "b", date: "2026-09-03", hours_billed: 4, total_value: 200 },
]

describe("buildDraft", () => {
  it("bills each log at the hourly rate", () => {
    const d = buildDraft(logs, { name: "Site", billing_mode: "hourly", hourly_rate: 50 }, [], "2026-09-30")
    expect(d.items).toHaveLength(2)
    expect(d.items[0]).toMatchObject({ log_id: "a", quantity: 8, unit: "hour", rate: 50, subtotal: 400 })
    expect(d.subtotal).toBe(600)
    expect(d.totalHours).toBe(12)
  })

  it("converts hours to days for a daily job", () => {
    const d = buildDraft(logs, { name: "Site", billing_mode: "daily", daily_rate: 400 }, [], "2026-09-30")
    expect(d.items[0]).toMatchObject({ quantity: 1, unit: "day", rate: 400 })
    expect(d.items[1]).toMatchObject({ quantity: 0.5, unit: "day" })
  })

  it("lists a project's worked days at no charge and closes with the contract value", () => {
    const d = buildDraft(logs, { name: "Site", billing_mode: "fixed", contract_value: 2182 }, [], "2026-09-30")
    expect(d.items).toHaveLength(3)
    expect(d.items[0]).toMatchObject({ log_id: "a", date: "2026-09-02", unit: "hour", rate: 0, subtotal: 0 })
    expect(d.items[2]).toMatchObject({ log_id: null, date: "2026-09-30", description: "Site", unit: "project", rate: 2182, subtotal: 2182, hours_billed: 12 })
    expect(d.subtotal).toBe(2182)
  })

  it("still prices a project that has no logged days", () => {
    const d = buildDraft([], { name: "Site", billing_mode: "fixed", contract_value: 900 }, [], "2026-09-30")
    expect(d.items).toHaveLength(1)
    expect(d.subtotal).toBe(900)
  })

  it("appends free lines and adds them to the subtotal", () => {
    const d = buildDraft(logs, { name: "Site", billing_mode: "hourly", hourly_rate: 50 }, [
      { description: "Stock footage", job_number: "J-1", quantity: 2, rate: 30 },
      { description: "   ", job_number: "", quantity: 1, rate: 10 },   // blank: dropped
      { description: "Zero", job_number: "", quantity: 0, rate: 10 },  // nothing to charge: dropped
    ], "2026-09-30")
    expect(d.items).toHaveLength(3)
    expect(d.items[2]).toMatchObject({ description: "Stock footage", job_number: "J-1", quantity: 2, rate: 30, subtotal: 60, is_manual: true })
    expect(d.subtotal).toBe(660)
  })
})

describe("usableManualLines", () => {
  it("keeps only lines with a description and a quantity", () => {
    expect(usableManualLines([
      { description: "ok", job_number: "", quantity: 1, rate: 1 },
      { description: "", job_number: "", quantity: 1, rate: 1 },
    ])).toHaveLength(1)
  })
})

describe("draftIsEmpty", () => {
  it("is empty for an hourly job with nothing to bill", () => {
    const job = { name: "X", billing_mode: "hourly" as const, hourly_rate: 10 }
    expect(draftIsEmpty(buildDraft([], job, [], "2026-09-30"), job)).toBe(true)
  })

  it("is never empty for a project, which always has its price", () => {
    const job = { name: "X", billing_mode: "fixed" as const, contract_value: 100 }
    expect(draftIsEmpty(buildDraft([], job, [], "2026-09-30"), job)).toBe(false)
  })
})

describe("invoiceLangFor", () => {
  it("speaks Portuguese in reais and English otherwise", () => {
    expect(invoiceLangFor("BRL")).toBe("pt")
    expect(invoiceLangFor("USD")).toBe("en")
    expect(invoiceLangFor("EUR")).toBe("en")
    expect(invoiceLangFor(null)).toBe("en")
  })
})
