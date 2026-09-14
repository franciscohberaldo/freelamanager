import { describe, it, expect } from "vitest"
import { X, Y, ROW, PAGE_W, PAGE_H, LOGO_W, LOGO_H, BODY_PT } from "@/lib/invoice-layout"

describe("invoice layout", () => {
  it("keeps every column on the page, inside a margin", () => {
    for (const [name, value] of Object.entries(X)) {
      expect(value, name).toBeGreaterThan(10)
      expect(value, name).toBeLessThan(PAGE_W - 10)
    }
  })

  it("keeps every row on the page", () => {
    for (const [name, value] of Object.entries(Y)) {
      expect(value, name).toBeGreaterThan(5)
      expect(value, name).toBeLessThan(PAGE_H - 5)
    }
  })

  it("runs the document down the page in the order it reads", () => {
    expect(Y.date).toBeLessThan(Y.header)
    expect(Y.header).toBeLessThan(Y.service)
    expect(Y.service).toBeLessThan(Y.itemsStart)
    expect(Y.itemsStart).toBeLessThan(Y.rule)
    expect(Y.rule).toBeLessThan(Y.total)
    expect(Y.total).toBeLessThan(Y.payment)
    expect(Y.payment).toBeLessThan(Y.additional2)
  })

  it("orders the columns left to right", () => {
    expect(X.logo).toBeLessThan(X.label)
    expect(X.label).toBeLessThan(X.itemDesc)
    expect(X.itemDesc).toBeLessThan(X.mid)
    expect(X.mid).toBeLessThan(X.bank)
    expect(X.bank).toBeLessThan(X.bankWide)
    expect(X.totalAmount).toBeLessThan(X.itemAmount)
    expect(X.itemAmount).toBeLessThan(X.edge)
  })

  // The row step comes from the model; a wrong sign would stack every item on one line.
  it("steps a positive amount between item rows", () => {
    expect(ROW).toBeGreaterThan(3)
    expect(ROW).toBeLessThan(6)
  })

  it("leaves room for a realistic number of items before the payment block", () => {
    const room = Math.floor((Y.rule - Y.itemsStart) / ROW)
    expect(room).toBeGreaterThanOrEqual(2)
  })

  it("keeps the logo in proportion to the original", () => {
    expect(LOGO_H / LOGO_W).toBeCloseTo(322 / 235, 2)
  })

  it("sets a body size that is readable and not oversized", () => {
    expect(BODY_PT).toBeGreaterThan(7)
    expect(BODY_PT).toBeLessThan(11)
  })
})
