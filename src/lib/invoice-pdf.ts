import jsPDF from "jspdf"
import { format, parseISO } from "date-fns"
import {
  invoiceT, invoiceLocale, formatInvoiceCurrency, formatQuantity, HOURS_PER_DAY,
  type InvoiceLang, type BillingUnit,
} from "@/lib/invoice-i18n"
import type { BillingMode } from "@/lib/billing-mode"
import { isWorkedDayLine } from "@/lib/invoice-items"
import { normalizeName } from "@/lib/text-case"
import { registerJost, JOST, type JostStyle } from "@/lib/fonts"
import {
  X, Y, ROW, BODY_PT, TOTAL_PT, INK, LOGO_W, LOGO_H, LOGO_TOP,
} from "@/lib/invoice-layout"


export function formatCurrencyPDF(value: number, currency: string = "BRL", lang: InvoiceLang = "pt"): string {
  return formatInvoiceCurrency(value, currency, lang)
}

/** The model writes money as "US$ 500" and "US$ 1,500": a sign, a thin space, no bare cents. */
const CURRENCY_SIGNS: Record<string, string> = { USD: "US$", BRL: "R$", EUR: "€" }

export function formatModelCurrency(value: number, currency: string): string {
  const sign = CURRENCY_SIGNS[currency] ?? `${currency} `
  const grouping = currency === "BRL" ? "pt-BR" : "en-US"
  // numeric columns may arrive as strings depending on the driver
  const n = typeof value === "number" ? value : Number(value)
  const decimals = Number.isInteger(n) ? 0 : 2
  const num = new Intl.NumberFormat(grouping, {
    minimumFractionDigits: decimals, maximumFractionDigits: 2,
  }).format(n)
  return `${sign} ${num}`
}

export function formatDatePDF(date: string | Date, lang: InvoiceLang = "pt"): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, invoiceLocale[lang]?.dateFormat ?? "dd/MM/yyyy")
}

/** The header's date stamp: "São Paulo, 20.07.2026". */
export function formatHeaderDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd.MM.yyyy")
}

/**
 * The day the invoice was issued: when it went to the client, else when it was written.
 * A preview that exists nowhere yet is dated today.
 */
export function issueDateOf(invoice: { sent_at?: string | null; created_at?: string | null }): Date {
  const stamp = invoice.sent_at ?? invoice.created_at
  return stamp ? parseISO(stamp) : new Date()
}

/**
 * Names and addresses are often stored in capitals (they come from the NFS-e and from
 * CNPJ lookups). The invoice reads them quietly: each piece between commas or dashes is
 * title-cased when it is all capitals, and acronyms and legal forms are left alone.
 */
export function quiet(text: string): string {
  return text.split(/(\s*[,;–-]\s*)/).map(seg => normalizeName(seg)).join("")
}

/**
 * The city in the header. A fiscal address is a comma list that usually ends in a zip code,
 * so the city is the last piece that has letters and no digits.
 */
export function cityOf(fiscalAddress: string | null | undefined): string {
  const raw = fiscalAddress ?? ""
  // Addresses written in the model's own style carry "City: Sao Paulo" inline.
  const inline = raw.match(/city:\s*([^,]+)/i)
  if (inline) return quiet(inline[1].trim())
  const parts = raw.split(",").map(p => p.trim()).filter(Boolean)
  const city = [...parts].reverse().find(p => /[a-zA-ZÀ-ú]/.test(p) && !/\d/.test(p))
  return quiet(city ?? "São Paulo")
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf      = await res.arrayBuffer()
    const base64   = Buffer.from(buf).toString("base64")
    const mimeType = res.headers.get("content-type") ?? "image/png"
    return `data:${mimeType};base64,${base64}`
  } catch {
    return null
  }
}

export interface InvoicePDFBankDetails {
  bank_beneficiary?: string | null
  bank_name?: string | null
  bank_account_type?: string | null
  bank_account_number?: string | null
  bank_routing?: string | null
  bank_swift?: string | null
  bank_iban?: string | null
  bank_address?: string | null
  pix_key?: string | null
  br_bank_name?: string | null
  br_bank_agency?: string | null
  br_bank_account?: string | null
}

export interface InvoicePDFParams {
  invoice: {
    invoice_number: string
    seq_number?: string | null
    po_number?: string | null
    period_start: string
    period_end: string
    due_date: string | null
    created_at?: string | null
    sent_at?: string | null
    currency: string
    subtotal: number
    tax_rate: number
    tax_amount: number
    total: number
    notes: string | null
  }
  items: Array<{
    date: string
    hours_billed: number
    rate: number
    subtotal: number
    quantity?: number | null
    unit?: BillingUnit | null
    description?: string | null
    job_number?: string | null
    is_manual?: boolean | null
  }>
  job: {
    name: string
    hourly_rate: number
    currency: string
    daily_rate?: number
    billing_mode?: BillingMode
    project_code?: string | null
  } | null
  client: {
    name: string
    company: string | null
    email: string | null
    legal_name?: string | null
    cnpj?: string | null
    address?: string | null
    billing_entity?: string | null
    billing_address?: string | null
  } | null
  settings: ({
    company_name: string | null
    cnpj_cpf: string | null
    logo_url: string | null
    invoice_color: string | null
    legal_name?: string | null
    fiscal_address?: string | null
    invoice_contact_email?: string | null
    invoice_contact_phone?: string | null
    intermediary_bank_name?: string | null
    intermediary_bank_swift?: string | null
    intermediary_bank_aba?: string | null
    intermediary_bank_account?: string | null
    intermediary_bank_address?: string | null
  } & InvoicePDFBankDetails) | null
  lang: InvoiceLang
}

/** Resolve the quantity/unit of a line item, falling back to hours for legacy items */
export function resolveItemQuantity(
  item: { hours_billed: number; quantity?: number | null; unit?: BillingUnit | null },
  billingMode: BillingMode = "hourly",
): { quantity: number; unit: BillingUnit } {
  if (item.unit && item.quantity != null) return { quantity: item.quantity, unit: item.unit }
  // A project is one line whatever was logged against it.
  if (billingMode === "fixed") return { quantity: 1, unit: "project" }
  if (billingMode === "daily") return { quantity: item.hours_billed / HOURS_PER_DAY, unit: "day" }
  return { quantity: item.hours_billed, unit: "hour" }
}

/**
 * The words on a priced line. A billed day names the project it was worked on (the
 * amount already carries the rate); any other line without a description shows its
 * quantity.
 */
export function itemLabel(
  item: { description?: string | null; is_manual?: boolean | null },
  q: { quantity: number; unit: BillingUnit },
  jobName: string | null | undefined,
  lang: InvoiceLang,
): string {
  if (item.description) return item.description
  if (q.unit === "day" && !item.is_manual && jobName) return jobName
  return formatQuantity(q.quantity, q.unit, lang)
}

const has = (v: string | null | undefined): v is string => !!v && v.trim().length > 0

/**
 * The invoice, drawn to the model in MaterialCliente_2 (260914_Buck Invoice 02, revised):
 * Jost on white; the city-date stamp at the top left and the monogram at the top right; the
 * client stacked under BILLED TO, the issuer's contact under RECIPIENT INFO; items over a
 * rule; and two payment sections at the foot — international wire and Brazilian Pix — so
 * the same invoice serves a bank anywhere.
 *
 * Positions come from `invoice-layout`, which carries the model's own coordinates.
 */
export async function generateInvoicePDF(params: InvoicePDFParams): Promise<ArrayBuffer> {
  const { invoice, items, job, client, settings, lang } = params
  const t = invoiceT[lang] ?? invoiceT.pt
  const cur = (v: number) => formatModelCurrency(v, invoice.currency)

  const billingMode = job?.billing_mode ?? "hourly"

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  registerJost(doc)

  const ink = (tone: readonly number[]) => doc.setTextColor(tone[0], tone[1], tone[2])

  /** Every piece of text on this invoice is one of four voices. */
  const say = (
    text: string,
    px: number,
    py: number,
    opts: { style?: JostStyle; size?: number; tone?: readonly number[]; align?: "right" } = {},
  ) => {
    if (!text) return
    doc.setFont(JOST, opts.style ?? "normal")
    doc.setFontSize(opts.size ?? BODY_PT)
    ink(opts.tone ?? INK.label)
    doc.text(text, px, py, opts.align ? { align: opts.align } : undefined)
  }

  /** A section heading: heavy, in sentence case — nothing on this invoice shouts. */
  const heading = (text: string, px: number, py: number) =>
    say(text, px, py, { style: "heavy" })

  /** A field label in the payment blocks. */
  const field = (text: string, px: number, py: number) =>
    say(text, px, py, { style: "heavy" })

  /** A payment section title, underlined like the model's. */
  const sectionTitle = (text: string, py: number) => {
    heading(text, X.label, py)
    doc.setFont(JOST, "heavy")
    doc.setFontSize(BODY_PT)
    const w = doc.getTextWidth(text)
    doc.setDrawColor(INK.label[0], INK.label[1], INK.label[2])
    doc.setLineWidth(0.3)
    doc.line(X.label, py + 0.9, X.label + w, py + 0.9)
  }

  // ── the date and the mark ────────────────────────────────────────────────────
  say(`${cityOf(settings?.fiscal_address)}, ${formatHeaderDate(issueDateOf(invoice))}`, X.label, Y.date, { style: "heavy" })
  if (settings?.logo_url) {
    const logo = await fetchImageBase64(settings.logo_url)
    if (logo) {
      try {
        doc.addImage(logo, "PNG", X.edge - LOGO_W, LOGO_TOP, LOGO_W, LOGO_H)
      } catch {
        // a logo that will not decode is not worth losing the invoice over
      }
    }
  }

  // ── who and when ───────────────────────────────────────────────────────────
  heading(`${t.billTo}:`, X.label, Y.header)
  heading(t.recipientInfo, X.right, Y.header)

  // the client, stacked under BILLED TO — long lines wrap so they never cross into the
  // recipient's column
  const clientWidth = X.right - X.label - 8
  const clientName = client?.billing_entity || client?.legal_name || client?.name || ""
  const clientRaw = [
    quiet(clientName),
    ...quiet(client?.billing_address || client?.address || "").split(/\s*[\n]\s*/).filter(Boolean),
    client?.email ?? "",
  ].filter(Boolean)
  const clientLines = clientRaw.flatMap(line => doc.splitTextToSize(line, clientWidth) as string[])
  clientLines.slice(0, 4).forEach((line, i) => say(line, X.label, Y.header + ROW * (i + 1)))

  // the issuer, on the right: name, then how to reach them, then where they are
  const recipientLines = [
    quiet(settings?.legal_name || settings?.company_name || ""),
    settings?.invoice_contact_email ?? "",
    settings?.invoice_contact_phone ?? "",
  ].filter(Boolean)
  recipientLines.forEach((line, i) => say(line, X.right, Y.header + ROW * (i + 1)))
  const fiscal = quiet((settings?.fiscal_address ?? "").trim())
  if (fiscal) {
    const wrapped = doc.splitTextToSize(fiscal, X.edge - X.right) as string[]
    const start = recipientLines.length + 1
    wrapped.slice(0, 5 - recipientLines.length).forEach((line, i) =>
      say(line, X.right, Y.header + ROW * (start + i)))
  }

  // ── what was ordered ───────────────────────────────────────────────────────
  heading(`${t.purchaseOrder}:`, X.label, Y.purchase)
  say(invoice.po_number ?? job?.project_code ?? "", X.mid, Y.purchase)

  heading(`${t.serviceOrdered}:`, X.label, Y.service)
  say(job?.name ?? "", X.label, Y.serviceValue)

  // ── the lines ──────────────────────────────────────────────────────────────
  // Every invoice lists the days worked. On a project each day names the job and puts
  // its hours where the money would go; the closed price is not a line — it shows only
  // once, as the Total below the rule.
  let y = Y.itemsStart
  for (const item of items) {
    // The fixed-price project line repeats the Total, so it stays off the list.
    if (billingMode === "fixed" && item.unit === "project" && !item.is_manual) continue
    const q = resolveItemQuantity(item, billingMode)
    const workedDay = isWorkedDayLine(item, billingMode)
    say(format(parseISO(item.date), invoiceLocale[lang]?.dayFormat ?? "dd/MM"), X.label, y, { tone: INK.figure })
    if (workedDay) {
      say(item.description ?? job?.name ?? t.workedDay, X.itemDesc, y, { tone: INK.figure })
      say(item.hours_billed > 0 ? formatQuantity(item.hours_billed, "hour", lang) : t.workedDay, X.itemAmount, y, { tone: INK.figure })
    } else {
      say(itemLabel(item, q, job?.name, lang), X.itemDesc, y, { tone: INK.figure })
      say(cur(item.subtotal), X.itemAmount, y, { tone: INK.figure })
    }
    y += ROW
  }

  const ruleY = Math.max(Y.rule, y + ROW / 2)
  doc.setDrawColor(INK.figure[0], INK.figure[1], INK.figure[2])
  doc.setLineWidth(0.15)
  doc.line(X.label, ruleY, X.itemAmount + 18, ruleY)

  let totalY = ruleY + (Y.total - Y.rule)
  if (invoice.tax_rate > 0) {
    say(t.subtotal, X.label, totalY, { tone: INK.figure })
    say(cur(invoice.subtotal), X.itemAmount, totalY, { tone: INK.figure })
    totalY += ROW
    say(`${t.taxes} (${invoice.tax_rate}%)`, X.label, totalY, { tone: INK.figure })
    say(cur(invoice.tax_amount), X.itemAmount, totalY, { tone: INK.figure })
    totalY += ROW
  }
  say("Total", X.label, totalY, { style: "bold", size: TOTAL_PT, tone: INK.figure })
  say(cur(invoice.total), X.itemAmount, totalY, { style: "bold", size: TOTAL_PT, tone: INK.figure })

  // ── how to pay ─────────────────────────────────────────────────────────────
  // Both sections print whenever their data exists: the same invoice serves a Brazilian
  // bank and an international one. The block is anchored low on the page; a long list of
  // items pushes it to its own page rather than letting the two collide.
  const hasInternational = [
    settings?.intermediary_bank_name, settings?.intermediary_bank_swift,
    settings?.intermediary_bank_aba, settings?.intermediary_bank_account,
    settings?.bank_swift, settings?.bank_iban, settings?.bank_beneficiary,
    settings?.bank_name,
  ].some(has)
  const hasBrazilian = [
    settings?.pix_key, settings?.br_bank_name, settings?.br_bank_agency, settings?.br_bank_account,
  ].some(has)

  let base = Y.paymentTitle
  if ((hasInternational || hasBrazilian) && totalY > Y.paymentTitle - 20) {
    doc.addPage()
    base = 30
  }
  const at = (anchor: number) => base + (anchor - Y.paymentTitle)

  if (hasInternational) {
    sectionTitle(t.internationalPayment, at(Y.paymentTitle))

    heading(t.paymentInstructions, X.label, at(Y.payment))
    say(t.wireOnly, X.bank, at(Y.payment), { style: "italic" })

    field(`${t.intermediaryBank}:`, X.label, at(Y.intermediary))
    say(settings?.intermediary_bank_swift ? `SWIFT: ${settings.intermediary_bank_swift}` : "", X.bank, at(Y.intermediary))
    say(settings?.intermediary_bank_aba ? `ABA: ${settings.intermediary_bank_aba}` : "", X.bank, at(Y.aba))
    say(settings?.intermediary_bank_account ? `${t.account}: ${settings.intermediary_bank_account}` : "", X.bank, at(Y.account))
    say(settings?.intermediary_bank_name ?? "", X.bank, at(Y.bankName))

    field(`${t.destinationBank}:`, X.label, at(Y.destination))
    say(settings?.bank_swift ? `SWIFT: ${settings.bank_swift}` : "", X.bank, at(Y.destination))
    say(settings?.bank_name ? `${t.beneficiaryBank}: ${settings.bank_name}` : "", X.bank, at(Y.beneficiaryBank))

    field(`${t.beneficiaryField}:`, X.label, at(Y.beneficiary))
    say(settings?.bank_beneficiary ? `${t.beneficiaryInBrazil}: ${settings.bank_beneficiary}` : "", X.bank, at(Y.beneficiary))
    say(settings?.bank_iban ? `IBAN: ${settings.bank_iban}` : "", X.bank, at(Y.iban))

    const extras = [
      settings?.intermediary_bank_address && settings?.intermediary_bank_name
        ? `${settings.intermediary_bank_name} address: ${settings.intermediary_bank_address}`
        : settings?.intermediary_bank_address ?? null,
      settings?.bank_address && settings?.bank_name
        ? `${settings.bank_name} address: ${settings.bank_address}`
        : settings?.bank_address ?? null,
    ].filter(Boolean) as string[]
    if (extras.length) {
      field(`${t.additionalInfo}:`, X.label, at(Y.additional))
      // the model indents the first line of each block; here every value shares one column
      extras.slice(0, 2).forEach((line, i) =>
        say(line, X.bank, at([Y.additional, Y.additional2][i])))
    }
  }

  if (hasBrazilian) {
    sectionTitle(t.brazilianPayment, at(Y.brTitle))
    if (has(settings?.pix_key)) {
      field("Pix", X.label, at(Y.pix))
      say(settings!.pix_key!, X.bank, at(Y.pix))
    }
    const brParts = [
      settings?.br_bank_name,
      has(settings?.br_bank_agency) ? `${t.agency} ${settings!.br_bank_agency}` : null,
      has(settings?.br_bank_account) ? `${t.checkingAccount} ${settings!.br_bank_account}` : null,
    ].filter(Boolean) as string[]
    if (brParts.length) {
      field(t.bankBranchAccount, X.label, at(Y.brBank))
      say(brParts.join(", "), X.bank, at(Y.brBank))
    }
  }

  if (invoice.notes) {
    const anchor = hasBrazilian ? Y.brBank : hasInternational ? Y.additional2 : Y.paymentTitle
    const lines = doc.splitTextToSize(`${t.notes}: ${invoice.notes}`, X.edge - X.label) as string[]
    say(lines.join("\n"), X.label, at(anchor) + ROW * 2, { tone: INK.figure })
  }

  return doc.output("arraybuffer")
}
