import { describe, it, expect } from "vitest"
import {
  DOCUMENT_KINDS, DOCUMENT_LABELS, isDocumentKind,
  validateDocument, documentPath, formatFileSize, MAX_DOCUMENT_BYTES,
} from "@/lib/job-documents"

describe("DOCUMENT_KINDS", () => {
  it("lists the six kinds a job can hold", () => {
    expect(DOCUMENT_KINDS).toEqual([
      "contract", "invoice", "nf", "das_received", "das_paid", "payment_proof",
    ])
  })

  it("labels every kind", () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(DOCUMENT_LABELS[kind]).toBeTruthy()
    }
  })
})

describe("isDocumentKind", () => {
  it("accepts a known kind", () => {
    expect(isDocumentKind("das_paid")).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isDocumentKind("contrato")).toBe(false)
    expect(isDocumentKind("")).toBe(false)
  })
})

describe("validateDocument", () => {
  const file = (type: string, size = 1000) => ({ type, size })

  it("accepts a PDF", () => {
    expect(validateDocument(file("application/pdf"))).toEqual({ ok: true })
  })

  it("accepts PNG and JPEG", () => {
    expect(validateDocument(file("image/png")).ok).toBe(true)
    expect(validateDocument(file("image/jpeg")).ok).toBe(true)
  })

  it("rejects a type the bucket does not allow", () => {
    const result = validateDocument(file("image/webp"))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/PDF/)
  })

  it("rejects a file over the limit", () => {
    const result = validateDocument(file("application/pdf", MAX_DOCUMENT_BYTES + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/10 MB/)
  })

  it("accepts a file exactly at the limit", () => {
    expect(validateDocument(file("application/pdf", MAX_DOCUMENT_BYTES)).ok).toBe(true)
  })
})

describe("documentPath", () => {
  it("nests the file under the owner and the job, named after the kind", () => {
    expect(documentPath("user-1", "job-9", "contract", "Contrato Final.PDF"))
      .toBe("user-1/job-9/contract.pdf")
  })

  it("falls back to pdf when the name carries no extension", () => {
    expect(documentPath("user-1", "job-9", "nf", "nota")).toBe("user-1/job-9/nf.pdf")
  })

  it("keeps only the last extension", () => {
    expect(documentPath("u", "j", "das_paid", "das.2026.09.png")).toBe("u/j/das_paid.png")
  })
})

describe("formatFileSize", () => {
  it("shows bytes under a kilobyte", () => {
    expect(formatFileSize(512)).toBe("512 B")
  })

  it("shows whole kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2 KB")
  })

  it("shows megabytes with one decimal", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB")
  })

  it("handles a missing size", () => {
    expect(formatFileSize(null)).toBe("—")
  })
})
