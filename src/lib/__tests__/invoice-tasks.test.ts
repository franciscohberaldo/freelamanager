import { describe, expect, it } from "vitest"
import { jobsNeedingDas, jobsNeedingInvoice, type InvoiceStageJob } from "../invoice-tasks"

const job = (overrides: Partial<InvoiceStageJob> = {}): InvoiceStageJob => ({
  status: "completed",
  end_date: "2026-11-10",
  invoices: [],
  job_documents: [],
  ...overrides,
})

describe("jobsNeedingInvoice", () => {
  it("includes a completed job with no invoice", () => {
    expect(jobsNeedingInvoice([job()])).toHaveLength(1)
  })

  it("does not ask for an invoice while the job is still active", () => {
    expect(jobsNeedingInvoice([job({ status: "active" })])).toHaveLength(0)
  })

  it("does not include a job whose invoice was sent", () => {
    expect(jobsNeedingInvoice([job({ invoices: [{ status: "sent" }] })])).toHaveLength(0)
  })

  it("accepts an invoice document even before the invoice is sent", () => {
    expect(jobsNeedingInvoice([job({ job_documents: [{ kind: "invoice" }] })])).toHaveLength(0)
  })

  it("keeps the task open when the only invoice was cancelled", () => {
    expect(jobsNeedingInvoice([job({ invoices: [{ status: "cancelled" }] })])).toHaveLength(1)
  })
})

describe("jobsNeedingDas", () => {
  it("includes a paid job with an issued NF and no paid DAS", () => {
    const pending = job({ invoices: [{ status: "paid", nf_status: "issued" }] })
    expect(jobsNeedingDas([pending])).toHaveLength(1)
  })

  it("does not include a job whose DAS was already paid", () => {
    const settled = job({
      invoices: [{ status: "paid", nf_status: "issued" }],
      job_documents: [{ kind: "das_paid" }],
    })
    expect(jobsNeedingDas([settled])).toHaveLength(0)
  })

  it("waits for the NF before asking for the DAS", () => {
    const waitingForNf = job({ invoices: [{ status: "paid", nf_status: "pending" }] })
    expect(jobsNeedingDas([waitingForNf])).toHaveLength(0)
  })
})
