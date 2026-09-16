import { describe, it, expect } from "vitest"
import {
  initialNfStatus, canTransition, assertTransition, isNfOverdue,
  NF_STATUS_LABELS, NF_SERIES_CODES, NF_SERIES_CUTOFF,
  seriesForDate, effectiveNfSeries, formatNfNumber, normalizeNfNumber,
} from "@/lib/nf-status"

describe("initialNfStatus", () => {
  it("BRL invoices start pending", () => expect(initialNfStatus("BRL")).toBe("pending"))
  it("foreign invoices start not_required", () => {
    expect(initialNfStatus("USD")).toBe("not_required")
    expect(initialNfStatus("EUR")).toBe("not_required")
  })
})

describe("canTransition", () => {
  it.each([
    ["not_required", "pending", true],
    ["pending", "requested", true],
    ["requested", "issued", true],
    ["issued", "sent", true],
    ["pending", "issued", true],
    ["requested", "pending", true],
    ["sent", "issued", false],
    ["issued", "pending", false],
    ["not_required", "issued", false],
    ["pending", "pending", false],
  ] as const)("%s → %s = %s", (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok)
  })
  it("assertTransition throws on an invalid move", () => {
    expect(() => assertTransition("sent", "pending")).toThrow("Transição inválida: sent → pending")
    expect(() => assertTransition("pending", "requested")).not.toThrow()
  })
})

describe("isNfOverdue", () => {
  const now = new Date("2026-09-12T12:00:00Z")
  it("pending for 8 days is overdue", () => expect(isNfOverdue("pending", "2026-09-04", now)).toBe(true))
  it("pending for 6 days is not overdue", () => expect(isNfOverdue("pending", "2026-09-06", now)).toBe(false))
  it("requested for 8 days is overdue", () => expect(isNfOverdue("requested", "2026-09-04T10:00:00Z", now)).toBe(true))
  it("issued is never overdue", () => expect(isNfOverdue("issued", "2026-01-01", now)).toBe(false))
  it("missing date is not overdue", () => expect(isNfOverdue("pending", null, now)).toBe(false))
  it("custom threshold", () => expect(isNfOverdue("pending", "2026-09-10", now, 1)).toBe(true))
})

describe("labels", () => {
  it("has a Portuguese label for every status", () => {
    expect(Object.keys(NF_STATUS_LABELS).sort()).toEqual(["issued", "not_required", "pending", "requested", "sent"])
  })
})

describe("seriesForDate", () => {
  it("notes issued before the move belong to Paulínia", () => {
    expect(seriesForDate("2019-12-31")).toBe("paulinia")
    expect(seriesForDate("2018-03-20")).toBe("paulinia")
  })
  it("notes issued from the cutoff on belong to São Paulo", () => {
    expect(seriesForDate(NF_SERIES_CUTOFF)).toBe("sao_paulo")
    expect(seriesForDate("2026-09-16")).toBe("sao_paulo")
  })
  it("a missing date defaults to the current city", () => {
    expect(seriesForDate(null)).toBe("sao_paulo")
    expect(seriesForDate(undefined)).toBe("sao_paulo")
  })
})

describe("effectiveNfSeries", () => {
  it("keeps the recorded series when there is one", () => {
    expect(effectiveNfSeries("paulinia", "2026-09-16")).toBe("paulinia")
    expect(effectiveNfSeries("sao_paulo", "2016-02-24")).toBe("sao_paulo")
  })
  it("derives the series from the date when none was recorded", () => {
    expect(effectiveNfSeries(null, "2016-02-24")).toBe("paulinia")
    expect(effectiveNfSeries(undefined, "2026-09-16")).toBe("sao_paulo")
  })
  it("falls back to the current city without series or date", () => {
    expect(effectiveNfSeries(null, null)).toBe("sao_paulo")
  })
})

describe("formatNfNumber", () => {
  it("pads the digits and appends the series code", () => {
    expect(formatNfNumber("paulinia", "30")).toBe("0030 PLN")
    expect(formatNfNumber("sao_paulo", "15")).toBe("0015 SP")
  })
  it("keeps an already padded number", () => {
    expect(formatNfNumber("sao_paulo", "0102")).toBe("0102 SP")
  })
  it("strips stray characters before padding", () => {
    expect(formatNfNumber("paulinia", "nfp 30")).toBe("0030 PLN")
  })
  it("omits the code when the series is unknown", () => {
    expect(formatNfNumber(null, "412")).toBe("0412")
  })
  it("returns an empty string without a number", () => {
    expect(formatNfNumber("sao_paulo", null)).toBe("")
    expect(formatNfNumber("sao_paulo", undefined)).toBe("")
  })
  it("has a code for every series", () => {
    expect(NF_SERIES_CODES).toEqual({ paulinia: "PLN", sao_paulo: "SP" })
  })
})

describe("normalizeNfNumber", () => {
  it("keeps only the digits, padded to four", () => {
    expect(normalizeNfNumber("30")).toBe("0030")
    expect(normalizeNfNumber("0030 PLN")).toBe("0030")
    expect(normalizeNfNumber("nfp 30")).toBe("0030")
    expect(normalizeNfNumber(" 15 ")).toBe("0015")
  })
  it("returns an empty string when there are no digits", () => {
    expect(normalizeNfNumber("")).toBe("")
    expect(normalizeNfNumber("PLN")).toBe("")
  })
})
