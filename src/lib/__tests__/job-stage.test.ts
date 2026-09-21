import { describe, it, expect } from "vitest"
import { jobStage, jobSteps } from "@/lib/job-stage"

const open      = { status: "active", end_date: "2026-07-31" }
const finished  = { status: "completed", end_date: "2026-07-31" }

describe("jobStage", () => {
  it("is work while the job is not completed, whatever else exists", () => {
    expect(jobStage(open, [{ status: "paid" }], [{ kind: "das_paid" }])).toBe("work")
  })

  it("asks for the invoice first once the work is done", () => {
    expect(jobStage(finished, [], [])).toBe("invoice")
    expect(jobStage(finished, [{ status: "draft" }], [])).toBe("invoice")
  })

  it("asks for the money once the invoice went out — the NF only comes after it", () => {
    expect(jobStage(finished, [{ status: "sent" }], [])).toBe("payment")
  })

  it("counts an attached invoice file as sent", () => {
    expect(jobStage(finished, [], [{ kind: "invoice" }])).toBe("payment")
  })

  it("then the NF, then the DAS", () => {
    expect(jobStage(finished, [{ status: "paid" }], [])).toBe("nf")
    expect(jobStage(finished, [{ status: "paid", nf_status: "issued" }], [])).toBe("das")
  })

  it("is done when the invoice is paid and everything before it is settled", () => {
    expect(jobStage(finished, [{ status: "paid", nf_status: "sent" }], [{ kind: "das_paid" }])).toBe("done")
  })

  it("still flags the DAS when the NF was issued before the tax was paid", () => {
    expect(jobStage(finished, [{ status: "paid", nf_status: "issued" }], [])).toBe("das")
  })
})

describe("jobSteps", () => {
  it("dates each step by the earliest thing that settled it", () => {
    const steps = jobSteps(finished, [
      { status: "paid", nf_status: "issued", sent_at: "2026-08-02T10:00:00Z", nf_issued_at: "2026-08-05", paid_at: "2026-08-20T10:00:00Z" },
    ], [{ kind: "das_paid", uploaded_at: "2026-09-10T10:00:00Z" }])
    expect(steps.map(s => [s.stage, s.done, s.at])).toEqual([
      ["work", true, "2026-07-31"],
      ["invoice", true, "2026-08-02T10:00:00Z"],
      ["payment", true, "2026-08-20T10:00:00Z"],
      ["nf", true, "2026-08-05"],
      ["das", true, "2026-09-10T10:00:00Z"],
    ])
  })
})
