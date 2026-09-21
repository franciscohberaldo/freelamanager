/**
 * The invoice e-mail, built once for both the preview and the actual send — what the user
 * sees in the confirmation dialog is byte-for-byte what the client receives.
 */
import { invoiceT, formatInvoiceCurrency, formatQuantity, type InvoiceLang, type BillingUnit } from "@/lib/invoice-i18n"
import { formatDatePDF, resolveItemQuantity } from "@/lib/invoice-pdf"
import { isWorkedDayLine } from "@/lib/invoice-items"
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

export interface EmailItem {
  date: string
  hours_billed: number
  rate: number
  subtotal: number
  quantity?: number | null
  unit?: BillingUnit | null
  description?: string | null
  is_manual?: boolean | null
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

export function buildInvoiceEmail({
  invoice, items, job, lang,
}: {
  invoice: EmailInvoice
  items: EmailItem[]
  job: EmailJob | null
  lang: InvoiceLang
}): { subject: string; html: string } {
  const t = invoiceT[lang]
  const formatCurrency = (value: number, currency: string) => formatInvoiceCurrency(value, currency, lang)
  const isDaily   = job?.billing_mode === "daily"
  const isProject = job?.billing_mode === "fixed"

  const periodStart = formatDatePDF(invoice.period_start, lang)
  const periodEnd   = formatDatePDF(invoice.period_end, lang)
  const jobLabel    = job?.project_code ? `${job.name} (${job.project_code})` : (job?.name ?? "")

  const itemsHtml = items.map((item) => {
    const q = resolveItemQuantity(item, job?.billing_mode ?? "hourly")
    // A worked day on a fixed-price project is listed for the record; the money sits in the total.
    const workedDay = isWorkedDayLine(item, job?.billing_mode)
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${formatDatePDF(item.date, lang)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${workedDay ? (item.description ?? job?.name ?? "") : (item.description ?? formatQuantity(q.quantity, q.unit, lang))}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${workedDay ? "—" : formatCurrency(item.rate, invoice.currency)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${workedDay ? (item.hours_billed > 0 ? formatQuantity(item.hours_billed, "hour", lang) : "—") : formatCurrency(item.subtotal, invoice.currency)}</td>
    </tr>
  `}).join("")

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:24px">${t.invoice} #${invoice.invoice_number}</h1>
        <p style="margin:4px 0 0;opacity:0.8">${periodStart} – ${periodEnd}</p>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:none">
        <p>${t.greeting(job?.clients?.name ?? "")}</p>
        <p>${t.body(periodStart, periodEnd, jobLabel)}</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead>
            <tr style="background:#f5f7ff">
              <th style="padding:10px 8px;text-align:left;border-bottom:2px solid #1e40af">${t.emailDate}</th>
              <th style="padding:10px 8px;text-align:center;border-bottom:2px solid #1e40af">${isProject ? t.emailProject : isDaily ? t.emailDays : t.emailHours}</th>
              <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #1e40af">${isProject ? t.emailRateProject : isDaily ? t.emailRateDay : t.emailRate}</th>
              <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #1e40af">${t.tableSubtotal}</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align:right;padding-top:12px;border-top:2px solid #eee">
          <p style="margin:4px 0">${t.subtotal}: <strong>${formatCurrency(invoice.subtotal, invoice.currency)}</strong></p>
          ${invoice.tax_rate > 0 ? `<p style="margin:4px 0">${t.taxes} (${invoice.tax_rate}%): <strong>${formatCurrency(invoice.tax_amount, invoice.currency)}</strong></p>` : ""}
          <p style="font-size:18px;color:#1e40af;margin:8px 0 0">
            <strong>${t.total}: ${formatCurrency(invoice.total, invoice.currency)}</strong>
          </p>
        </div>

        ${invoice.notes ? `<p style="margin-top:20px;color:#666;font-size:13px">${t.notes}: ${invoice.notes}</p>` : ""}
      </div>
    </div>
  `

  return { subject: t.subject(invoice.invoice_number, job?.name ?? "Freela Manager"), html }
}
