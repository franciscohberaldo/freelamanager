/**
 * The invoice e-mail: who receives it, and the message that carries the PDF.
 */
import { invoiceT, formatInvoiceCurrency, type InvoiceLang } from "@/lib/invoice-i18n"
import { formatDatePDF } from "@/lib/invoice-pdf"
import { parseEmails } from "@/lib/emails"
import type { BillingMode } from "@/lib/billing-mode"

export interface EmailInvoice {
  invoice_number: string
  period_start: string
  period_end: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  notes: string | null
}

export interface EmailJob {
  name: string
  billing_mode?: BillingMode
  project_code?: string | null
  clients?: { name: string } | null
}

/**
 * The client's own address is the recipient and marked contacts are copied. When the
 * client has no address of its own, the marked contacts become the recipients.
 */
export function resolveRecipients(
  clientEmailField: string | null | undefined,
  contactEmails: (string | null)[],
): { to: string[]; cc: string[] } {
  const [primary, ...extras] = parseEmails(clientEmailField)
  const marked = [...new Set(contactEmails.flatMap(e => parseEmails(e)))]
  if (!primary) return { to: marked, cc: [] }
  return { to: [primary], cc: [...new Set([...extras, ...marked])].filter(e => e !== primary) }
}

/**
 * The subject and the plain-text message the send dialog opens with. The invoice itself
 * travels as the attached PDF, so the message only introduces it; the user edits the text
 * before it leaves.
 */
export function buildInvoiceEmail({
  invoice, job, lang, senderName,
}: {
  invoice: EmailInvoice
  job: EmailJob | null
  lang: InvoiceLang
  senderName?: string | null
}): { subject: string; text: string } {
  const t = invoiceT[lang]
  const start = formatDatePDF(invoice.period_start, lang)
  const end   = formatDatePDF(invoice.period_end, lang)
  const total = formatInvoiceCurrency(invoice.total, invoice.currency, lang)
  const jobName = job?.name ?? ""
  const client  = job?.clients?.name ?? ""
  const sign    = senderName ? `\n${senderName}` : ""

  const paragraphs = lang === "en"
    ? [
        client ? `Hi ${client},` : "Hi,",
        `Please find attached invoice #${invoice.invoice_number} for ${jobName}, covering ${start} to ${end}.`,
        `Total: ${total}`,
        invoice.notes ? `${t.notes}: ${invoice.notes}` : "",
        `Best regards,${sign}`,
      ]
    : [
        client ? `Olá, ${client},` : "Olá,",
        `Segue em anexo o invoice #${invoice.invoice_number} referente a ${jobName}, período de ${start} a ${end}.`,
        `Total: ${total}`,
        invoice.notes ? `${t.notes}: ${invoice.notes}` : "",
        `Atenciosamente,${sign}`,
      ]

  return {
    subject: t.subject(invoice.invoice_number, jobName || "Freela Manager"),
    text: paragraphs.filter(Boolean).join("\n\n"),
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** The typed message as e-mail HTML: blank lines split paragraphs, single breaks stay breaks. */
export function emailHtmlFromText(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/)
    .map(p => `<p style="margin:0 0 14px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:600px">${paragraphs.join("")}</div>`
}
