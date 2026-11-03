import { describe, it, expect } from "vitest"
import { easterSunday, holidaysOfYear, isHoliday } from "@/lib/holidays"
import { format } from "date-fns"

describe("easterSunday", () => {
  it("matches known Easter dates", () => {
    expect(format(easterSunday(2024), "yyyy-MM-dd")).toBe("2024-03-31")
    expect(format(easterSunday(2025), "yyyy-MM-dd")).toBe("2025-04-20")
    expect(format(easterSunday(2026), "yyyy-MM-dd")).toBe("2026-04-05")
    expect(format(easterSunday(2027), "yyyy-MM-dd")).toBe("2027-03-28")
  })
})

describe("holidaysOfYear", () => {
  it("includes the fixed national holidays", () => {
    const days = holidaysOfYear(2026)
    for (const d of ["2026-01-01", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25"]) {
      expect(days).toContain(d)
    }
  })

  it("derives the movable holidays from Easter", () => {
    // Easter 2026 is April 5th
    const days = holidaysOfYear(2026)
    expect(days).toContain("2026-02-16") // Carnaval (segunda)
    expect(days).toContain("2026-02-17") // Carnaval (terça)
    expect(days).toContain("2026-04-03") // Sexta-feira Santa
    expect(days).toContain("2026-06-04") // Corpus Christi
  })
})

describe("isHoliday", () => {
  it("recognizes holidays and rejects ordinary days", () => {
    expect(isHoliday("2026-12-25")).toBe(true)
    expect(isHoliday("2026-04-03")).toBe(true)
    expect(isHoliday("2026-07-27")).toBe(false)
  })
})
