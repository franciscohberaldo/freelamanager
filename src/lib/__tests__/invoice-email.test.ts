import { describe, it, expect } from "vitest"
import { buildInvoiceEmail, emailHtmlFromText } from "@/lib/invoice-email"

const invoice = {
  invoice_number: "2026-004", period_start: "2026-08-03", period_end: "2026-08-28",
  subtotal: 10000, tax_rate: 0, tax_amount: 0, total: 10000, currency: "USD", notes: null,
}
const job = { name: "PHANTOM_RAOUL_PHACA-N0001", clients: { name: "Buck" } }

describe("buildInvoiceEmail", () => {
  it("opens an English message that points to the attached invoice and signs off", () => {
    const { subject, text } = buildInvoiceEmail({ invoice, job, lang: "en", senderName: "Estudio Judite EIRELI" })
    expect(subject).toBe("Invoice #2026-004 — PHANTOM_RAOUL_PHACA-N0001")
    expect(text).toContain("Hi Buck,")
    expect(text).toContain("Please find attached invoice #2026-004 for PHANTOM_RAOUL_PHACA-N0001")
    expect(text).toContain("08/03/2026")
    expect(text).toMatch(/Total: .*10,000/)
    expect(text.endsWith("Best regards,\nEstudio Judite EIRELI")).toBe(true)
  })

  it("writes Portuguese and carries the invoice notes", () => {
    const { text } = buildInvoiceEmail({ invoice: { ...invoice, notes: "PO a confirmar" }, job, lang: "pt" })
    expect(text).toContain("Olá, Buck,")
    expect(text).toContain("Segue em anexo o invoice #2026-004")
    expect(text).toContain("Notas: PO a confirmar")
    expect(text.endsWith("Atenciosamente,")).toBe(true)
  })
})

describe("emailHtmlFromText", () => {
  it("turns blank lines into paragraphs and single breaks into <br>", () => {
    const html = emailHtmlFromText("Hi Buck,\n\nBest regards,\nChico")
    expect(html).toContain(">Hi Buck,</p>")
    expect(html).toContain(">Best regards,<br>Chico</p>")
  })

  it("escapes what the user typed", () => {
    expect(emailHtmlFromText("a <b> & c")).toContain("a &lt;b&gt; &amp; c")
  })
})
