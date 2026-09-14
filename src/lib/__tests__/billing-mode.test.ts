import { describe, it, expect } from "vitest"
import { resolveItemQuantity } from "@/lib/invoice-pdf"
import { formatQuantity, HOURS_PER_DAY } from "@/lib/invoice-i18n"
import { BILLING_MODES, BILLING_MODE_LABELS, isBillingMode, rateOf, rateLabel } from "@/lib/billing-mode"

describe("BILLING_MODES", () => {
  it("offers three ways to charge", () => {
    expect(BILLING_MODES).toEqual(["hourly", "daily", "fixed"])
  })

  it("labels each one", () => {
    expect(BILLING_MODE_LABELS.hourly).toBe("Por hora")
    expect(BILLING_MODE_LABELS.daily).toBe("Por dia")
    expect(BILLING_MODE_LABELS.fixed).toBe("Por projeto")
  })

  it("accepts its own modes and nothing else", () => {
    expect(isBillingMode("fixed")).toBe(true)
    expect(isBillingMode("project")).toBe(false)
  })
})

describe("rateOf", () => {
  const job = { billing_mode: "hourly" as const, hourly_rate: 150, daily_rate: 1000, contract_value: 8000 }

  it("reads the hourly rate", () => {
    expect(rateOf(job)).toBe(150)
  })

  it("reads the daily rate", () => {
    expect(rateOf({ ...job, billing_mode: "daily" })).toBe(1000)
  })

  it("reads the closed price of a project", () => {
    expect(rateOf({ ...job, billing_mode: "fixed" })).toBe(8000)
  })

  it("treats a project with no price as zero", () => {
    expect(rateOf({ ...job, billing_mode: "fixed", contract_value: null })).toBe(0)
  })
})

describe("rateLabel", () => {
  it("suffixes by the unit charged", () => {
    expect(rateLabel("hourly")).toBe("/h")
    expect(rateLabel("daily")).toBe("/dia")
  })

  it("says a project price is closed, not per unit", () => {
    expect(rateLabel("fixed")).toBe(" · projeto")
  })
})

describe("resolveItemQuantity", () => {
  const item = { hours_billed: 24 }

  it("counts hours when charging by the hour", () => {
    expect(resolveItemQuantity(item, "hourly")).toEqual({ quantity: 24, unit: "hour" })
  })

  it("counts days when charging by the day", () => {
    expect(resolveItemQuantity(item, "daily")).toEqual({ quantity: 24 / HOURS_PER_DAY, unit: "day" })
  })

  // A closed price is one line for the whole thing, however many hours went into it.
  it("counts one project when the price is closed", () => {
    expect(resolveItemQuantity(item, "fixed")).toEqual({ quantity: 1, unit: "project" })
  })

  it("still lets an item state its own quantity and unit", () => {
    expect(resolveItemQuantity({ hours_billed: 24, quantity: 3, unit: "day" }, "fixed"))
      .toEqual({ quantity: 3, unit: "day" })
  })
})

describe("formatQuantity", () => {
  it("prints hours and days as before", () => {
    expect(formatQuantity(12, "hour", "pt")).toBe("12h")
    expect(formatQuantity(1, "day", "pt")).toBe("1 dia")
    expect(formatQuantity(3, "day", "pt")).toBe("3 dias")
    expect(formatQuantity(3, "day", "en")).toBe("3 days")
  })

  it("prints a project in both languages", () => {
    expect(formatQuantity(1, "project", "pt")).toBe("1 projeto")
    expect(formatQuantity(2, "project", "pt")).toBe("2 projetos")
    expect(formatQuantity(1, "project", "en")).toBe("1 project")
    expect(formatQuantity(2, "project", "en")).toBe("2 projects")
  })
})
