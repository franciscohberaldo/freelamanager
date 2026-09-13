import { describe, it, expect } from "vitest"
import { summarizeJob, compactNumbers, type HistoryInvoice } from "@/lib/job-history"

const inv = (o: Partial<HistoryInvoice> = {}): HistoryInvoice => ({
  seq_number: null,
  invoice_number: "1",
  nf_number: null,
  total: 1000,
  currency: "BRL",
  status: "paid",
  nf_status: "not_required",
  ...o,
})

describe("summarizeJob", () => {
  it("sums invoice totals per currency", () => {
    const s = summarizeJob([inv({ total: 19200 }), inv({ total: 19200 })])
    expect(s.totals).toEqual([{ currency: "BRL", amount: 38400 }])
  })

  it("keeps currencies apart instead of summing them", () => {
    const s = summarizeJob([inv({ total: 1000, currency: "BRL" }), inv({ total: 500, currency: "USD" })])
    expect(s.totals).toEqual([
      { currency: "BRL", amount: 1000 },
      { currency: "USD", amount: 500 },
    ])
  })

  it("reports no_invoice for a job that was never billed", () => {
    const s = summarizeJob([])
    expect(s.billing).toBe("no_invoice")
    expect(s.totals).toEqual([])
  })

  it("reports receivable while any invoice is unpaid", () => {
    expect(summarizeJob([inv({ status: "paid" }), inv({ status: "sent" })]).billing).toBe("receivable")
    expect(summarizeJob([inv({ status: "overdue" })]).billing).toBe("receivable")
    expect(summarizeJob([inv({ status: "draft" })]).billing).toBe("receivable")
  })

  it("reports received once every invoice is paid", () => {
    expect(summarizeJob([inv({ status: "paid" }), inv({ status: "paid" })]).billing).toBe("received")
  })

  it("flags a pending NF regardless of payment", () => {
    expect(summarizeJob([inv({ nf_status: "pending" })]).nfPending).toBe(true)
    expect(summarizeJob([inv({ nf_status: "requested" })]).nfPending).toBe(true)
    expect(summarizeJob([inv({ nf_status: "issued" })]).nfPending).toBe(false)
    expect(summarizeJob([inv({ nf_status: "sent" })]).nfPending).toBe(false)
    expect(summarizeJob([inv({ nf_status: "not_required" })]).nfPending).toBe(false)
  })

  it("labels invoices by sequence number, falling back to the invoice number", () => {
    const s = summarizeJob([inv({ seq_number: "0100" }), inv({ seq_number: null, invoice_number: "7" })])
    expect(s.invoiceLabel).toBe("0100, #7")
  })

  it("labels NFs and shows an em dash when there is none", () => {
    expect(summarizeJob([inv({ nf_number: "412" }), inv({ nf_number: "413" })]).nfLabel).toBe("412, 413")
    expect(summarizeJob([inv({ nf_number: null })]).nfLabel).toBe("—")
    expect(summarizeJob([]).nfLabel).toBe("—")
  })

  it("counts invoices instead of listing them past three", () => {
    const s = summarizeJob([1, 2, 3, 4].map(n => inv({ seq_number: `010${n}` })))
    expect(s.invoiceLabel).toBe("4 invoices")
  })

  it("collapses more than three NFs into a range", () => {
    const s = summarizeJob(["50", "51", "52", "117"].map(n => inv({ nf_number: n })))
    expect(s.nfLabel).toBe("50–117")
  })

  it("counts invoices without a paid date as unpaid even when the NF was sent", () => {
    const s = summarizeJob([inv({ status: "sent", nf_status: "sent" })])
    expect(s.billing).toBe("receivable")
    expect(s.nfPending).toBe(false)
  })
})

describe("compactNumbers", () => {
  it("lists up to three values", () => {
    expect(compactNumbers(["1", "2", "3"])).toBe("1, 2, 3")
  })

  it("ranges from the lowest to the highest past three", () => {
    expect(compactNumbers(["9", "1", "5", "3"])).toBe("1–9")
  })

  it("drops nulls before deciding", () => {
    expect(compactNumbers([null, "4", null])).toBe("4")
  })

  it("returns an em dash when nothing is left", () => {
    expect(compactNumbers([])).toBe("—")
    expect(compactNumbers([null, null])).toBe("—")
  })
})
