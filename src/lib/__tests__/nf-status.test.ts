import { describe, it, expect } from "vitest"
import { initialNfStatus, canTransition, assertTransition, isNfOverdue, NF_STATUS_LABELS } from "@/lib/nf-status"

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
