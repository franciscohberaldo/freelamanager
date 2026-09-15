import jsPDF from "jspdf"
import { format, parseISO } from "date-fns"
import {
  invoiceT, invoiceLocale, formatInvoiceCurrency, formatQuantity, HOURS_PER_DAY,
  type InvoiceLang, type BillingUnit,
} from "@/lib/invoice-i18n"
import type { BillingMode } from "@/lib/billing-mode"
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
  const decimals = Number.isInteger(value) ? 0 : 2
  const num = new Intl.NumberFormat(grouping, {
    minimumFractionDigits: decimals, maximumFractionDigits: 2,
  }).format(value)
  return `${sign} ${num}`
}

export function formatDatePDF(date: string | Date, lang: InvoiceLang = "pt"): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, invoiceLocale[lang]?.dateFormat ?? "dd/MM/yyyy")
}

/** The header's date stamp, as in the model: "SÃO PAULO, 20.07.2026". */
export function formatHeaderDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd.MM.yyyy")
}

/**
 * The city in the header. A fiscal address is a comma list that usually ends in a zip code,
 * so the city is the last piece that has letters and no digits.
 */
export function cityOf(fiscalAddress: string | null | undefined): string {
  const parts = (fiscalAddress ?? "").split(",").map(p => p.trim()).filter(Boolean)
  const city = [...parts].reverse().find(p => /[a-zA-ZÀ-ú]/.test(p) && !/\d/.test(p))
  return (city ?? "São Paulo").toUpperCase()
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
}

export interface InvoicePDFParams {
  invoice: {
    invoice_number: string
    seq_number?: string | null
    po_number?: string | null
    period_start: string
    period_end: string
    due_date: string | null
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

/** Bank rows to print: wire details for foreign currency, PIX for BRL. Empty fields are skipped. */
export function paymentDetailRows(
  settings: InvoicePDFBankDetails | null | undefined,
  currency: string,
  lang: InvoiceLang,
): Array<[string, string]> {
  if (!settings) return []
  const t = invoiceT[lang] ?? invoiceT.pt
  const rows: Array<[string, string | null | undefined]> = currency === "BRL"
    ? [
        [t.beneficiary, settings.bank_beneficiary],
        [t.bankName,    settings.bank_name],
        [t.pixKey,      settings.pix_key],
      ]
    : [
        [t.beneficiary,   settings.bank_beneficiary],
        [t.bankName,      settings.bank_name],
        [t.accountType,   settings.bank_account_type],
        [t.accountNumber, settings.bank_account_number],
        [t.routing,       settings.bank_routing],
        [t.swift,         settings.bank_swift],
        [t.iban,          settings.bank_iban],
        [t.bankAddress,   settings.bank_address],
      ]
  return rows.filter((r): r is [string, string] => !!r[1] && r[1].trim().length > 0)
}


/**
 * The invoice, drawn to the model in MaterialCliente_2 (260914_Buck Invoice 02): Jost on
 * white, the monogram at the top left and the city-date stamp at the top right; labels in
 * black capitals and figures in a softer grey; the client in the middle, the issuer's
 * contact on the right; items over a rule; payment instructions anchored at the foot.
 *
 * Positions come from `invoice-layout`, which carries the model's own coordinates.
 */
export async function generateInvoicePDF(params: InvoicePDFParams): Promise<ArrayBuffer> {
  const { invoice, items, job, client, settings, lang } = params
  const t = invoiceT[lang] ?? invoiceT.pt
  const cur = (v: number) => formatModelCurrency(v, invoice.currency)

  const billingMode = job?.billing_mode ?? "hourly"
  const isBRL = invoice.currency === "BRL"

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

  const heading = (text: string, px: number, py: number) =>
    say(text.toUpperCase(), px, py, { style: "heavy" })

  // ── the mark and the date ────────────────────────────────────────────────────
  if (settings?.logo_url) {
    const logo = await fetchImageBase64(settings.logo_url)
    if (logo) {
      try {
        doc.addImage(logo, "PNG", X.logo, LOGO_TOP, LOGO_W, LOGO_H)
      } catch {
        // a logo that will not decode is not worth losing the invoice over
      }
    }
  }
  say(`${cityOf(settings?.fiscal_address)}, ${formatHeaderDate(invoice.period_end)}`, X.edge, Y.date, { style: "heavy", align: "right" })

  // ── who and when ───────────────────────────────────────────────────────────
  heading(`${t.billTo}:`, X.label, Y.header)
  heading(t.recipientInfo, X.right, Y.header)

  // the client, in the middle column
  const clientName = client?.billing_entity || client?.legal_name || client?.name || ""
  const clientLines = [
    clientName,
    ...(client?.billing_address || client?.address || "").split(/\s*[\n]\s*/).filter(Boolean),
    client?.email ?? "",
  ].filter(Boolean)
  say(clientLines[0] ?? "", X.mid, Y.header)
  const clientRows = [Y.line2, Y.line3, Y.line4]
  clientLines.slice(1, 4).forEach((line, i) => say(line, X.mid, clientRows[i]))

  // the issuer, on the right: name, then how to reach them, then where they are
  say(settings?.legal_name || settings?.company_name || "", X.right, Y.line2)
  say(settings?.invoice_contact_email ? `Email: ${settings.invoice_contact_email}` : "", X.right, Y.line3)
  say(settings?.invoice_contact_phone ? `${t.tel}: ${settings.invoice_contact_phone}` : "", X.right, Y.line4)
  const fiscal = (settings?.fiscal_address ?? "").trim()
  if (fiscal) {
    const wrapped = doc.splitTextToSize(`${t.streetAddress}: ${fiscal}`, X.edge - X.right) as string[]
    wrapped.slice(0, 3).forEach((line, i) => say(line, X.right, [Y.line5, Y.purchase, Y.service][i]))
  }

  // ── what was ordered ───────────────────────────────────────────────────────
  heading(`${t.purchaseOrder}:`, X.label, Y.purchase)
  say(invoice.po_number ?? job?.project_code ?? "", X.mid, Y.purchase)

  heading(`${t.serviceOrdered}:`, X.label, Y.service)
  say(job?.name ?? "", X.mid, Y.service)

  // ── the lines ──────────────────────────────────────────────────────────────
  let y = Y.itemsStart
  for (const item of items) {
    const q = resolveItemQuantity(item, billingMode)
    say(format(parseISO(item.date), "dd/MM"), X.label, y, { tone: INK.figure })
    say(item.description ?? formatQuantity(q.quantity, q.unit, lang), X.itemDesc, y, { tone: INK.figure })
    say(cur(item.subtotal), X.itemAmount, y, { tone: INK.figure })
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
  // The payment block is anchored low on the page; a long list of items pushes it to its
  // own page rather than letting the two collide.
  let base = Y.payment
  if (totalY > Y.payment - 20) {
    doc.addPage()
    base = 30
  }
  const at = (anchor: number) => base + (anchor - Y.payment)

  heading(t.paymentInstructions, X.label, at(Y.payment))
  say(isBRL ? t.pixOnly : t.wireOnly, X.bank, at(Y.payment), { style: "italic" })

  if (isBRL) {
    for (const [i, [label, value]] of paymentDetailRows(settings, invoice.currency, lang).entries()) {
      say(`${label}: ${value}`, X.bank, at([Y.intermediary, Y.aba, Y.account, Y.bankName][i] ?? Y.bankName))
    }
  } else {
    heading(`${t.intermediaryBank}:`, X.label, at(Y.intermediary))
    say(settings?.intermediary_bank_swift ? `SWIFT: ${settings.intermediary_bank_swift}` : "", X.bankWide, at(Y.intermediary))
    say(settings?.intermediary_bank_aba ? `ABA: ${settings.intermediary_bank_aba}` : "", X.bank, at(Y.aba))
    say(settings?.intermediary_bank_account ? `${t.account}: ${settings.intermediary_bank_account}` : "", X.bank, at(Y.account))
    say(settings?.intermediary_bank_name ?? "", X.bank, at(Y.bankName))

    heading(`${t.destinationBank}:`, X.label, at(Y.destination))
    say(settings?.bank_swift ? `SWIFT: ${settings.bank_swift}` : "", X.bank, at(Y.destination))
    say(settings?.bank_name ? `${t.beneficiaryBank}: ${settings.bank_name}` : "", X.bank, at(Y.beneficiaryBank))

    heading(`${t.beneficiaryField}:`, X.label, at(Y.beneficiary))
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
      heading(`${t.additionalInfo}:`, X.label, at(Y.additional))
      extras.slice(0, 2).forEach((line, i) =>
        say(line, i === 0 ? X.bankWide : X.bank, at([Y.additional, Y.additional2][i])))
    }
  }

  if (invoice.notes) {
    const lines = doc.splitTextToSize(`${t.notes}: ${invoice.notes}`, X.edge - X.label) as string[]
    say(lines.join("\n"), X.label, at(Y.additional2) + ROW * 2, { tone: INK.figure })
  }

  return doc.output("arraybuffer")
}
