import { describe, it, expect } from "vitest"
import { summarizeJob, compactNumbers, compareRows, type HistoryInvoice, type SortableRow } from "@/lib/job-history"

const inv = (o: Partial<HistoryInvoice> = {}): HistoryInvoice => ({
  seq_number: null,
  invoice_number: "1",
  nf_number: null,
  total: 1000,
  currency: "BRL",
  status: "paid",
  nf_status: "not_required",
  period_start: "2020-01-01",
  period_end: "2020-01-01",
  nf_issued_at: null,
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

describe("summarizeJob dates", () => {
  const dated = (o: Partial<HistoryInvoice>) => inv({ period_start: "2018-03-20", period_end: "2018-03-20", ...o })

  it("spans from the earliest period start to the latest period end", () => {
    const s = summarizeJob([
      dated({ period_start: "2018-03-20", period_end: "2018-03-31" }),
      dated({ period_start: "2019-08-01", period_end: "2019-08-12" }),
    ])
    expect(s.start).toBe("2018-03-20")
    expect(s.end).toBe("2019-08-12")
  })

  it("reports a single NF issue date as a point, not a range", () => {
    const s = summarizeJob([dated({ nf_issued_at: "2018-12-14" })])
    expect(s.nfFrom).toBe("2018-12-14")
    expect(s.nfTo).toBe("2018-12-14")
  })

  it("spans the NF issue dates when several were issued", () => {
    const s = summarizeJob([
      dated({ nf_issued_at: "2019-08-12" }),
      dated({ nf_issued_at: "2018-03-20" }),
      dated({ nf_issued_at: null }),
    ])
    expect(s.nfFrom).toBe("2018-03-20")
    expect(s.nfTo).toBe("2019-08-12")
  })

  it("leaves the NF dates empty when no NF was ever issued", () => {
    const s = summarizeJob([dated({ nf_issued_at: null })])
    expect(s.nfFrom).toBeNull()
    expect(s.nfTo).toBeNull()
  })

  it("falls back to the job's own dates when it has no invoices", () => {
    const s = summarizeJob([], { start_date: "2026-09-01", end_date: null })
    expect(s.start).toBe("2026-09-01")
    expect(s.end).toBeNull()
  })

  it("prefers the invoice span over the job's recorded dates", () => {
    const s = summarizeJob([dated({ period_start: "2018-03-20", period_end: "2018-03-31" })], { start_date: "2000-01-01", end_date: "2000-12-31" })
    expect(s.start).toBe("2018-03-20")
    expect(s.end).toBe("2018-03-31")
  })
})

describe("compareRows", () => {
  const row = (o: Partial<SortableRow> = {}): SortableRow => ({ tomador: "A", marca: "A", job: "A", contract: 0, rate: 0, amount: 0, start: "2020-01-01", end: "2020-01-01", nf: "2020-01-01", ...o })

  it("orders text case-insensitively", () => {
    expect(compareRows(row({ job: "amazon" }), row({ job: "Boticario" }), "job", "asc")).toBeLessThan(0)
    expect(compareRows(row({ job: "amazon" }), row({ job: "Boticario" }), "job", "desc")).toBeGreaterThan(0)
  })

  it("orders by brand, with the unset ones last", () => {
    expect(compareRows(row({ marca: "Havaianas" }), row({ marca: "Mastercard" }), "marca", "asc")).toBeLessThan(0)
    expect(compareRows(row({ marca: "" }), row({ marca: "Mastercard" }), "marca", "asc")).toBeGreaterThan(0)
    expect(compareRows(row({ marca: "" }), row({ marca: "Mastercard" }), "marca", "desc")).toBeGreaterThan(0)
  })

  it("orders amounts numerically, not as text", () => {
    expect(compareRows(row({ amount: 9000 }), row({ amount: 10000 }), "total", "asc")).toBeLessThan(0)
    expect(compareRows(row({ contract: 9000 }), row({ contract: 10000 }), "contract", "asc")).toBeLessThan(0)
    expect(compareRows(row({ contract: 9000 }), row({ contract: 10000 }), "contract", "desc")).toBeGreaterThan(0)
    expect(compareRows(row({ rate: 150 }), row({ rate: 1200 }), "rate", "asc")).toBeLessThan(0)
  })

  it("orders dates chronologically", () => {
    expect(compareRows(row({ start: "2015-08-10" }), row({ start: "2019-01-01" }), "start", "asc")).toBeLessThan(0)
    expect(compareRows(row({ start: "2015-08-10" }), row({ start: "2019-01-01" }), "start", "desc")).toBeGreaterThan(0)
  })

  it("keeps rows without a date at the bottom in both directions", () => {
    expect(compareRows(row({ start: null }), row({ start: "2019-01-01" }), "start", "asc")).toBeGreaterThan(0)
    expect(compareRows(row({ start: null }), row({ start: "2019-01-01" }), "start", "desc")).toBeGreaterThan(0)
    expect(compareRows(row({ start: "2019-01-01" }), row({ start: null }), "start", "desc")).toBeLessThan(0)
  })

  it("treats two missing dates as a tie", () => {
    expect(compareRows(row({ start: null }), row({ start: null }), "start", "asc")).toBe(0)
  })
})
