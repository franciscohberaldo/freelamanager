import { describe, expect, it } from "vitest"
import { jobsNeedingInvoice, type InvoiceStageJob } from "../invoice-tasks"

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
