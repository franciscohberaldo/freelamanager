import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format, parseISO } from "date-fns"
import {
  invoiceT, invoiceLocale, formatInvoiceCurrency, formatQuantity, HOURS_PER_DAY,
  type InvoiceLang, type BillingUnit,
} from "@/lib/invoice-i18n"
import type { BillingMode } from "@/lib/billing-mode"

export function formatCurrencyPDF(value: number, currency: string = "BRL", lang: InvoiceLang = "pt"): string {
  return formatInvoiceCurrency(value, currency, lang)
}

export function formatDatePDF(date: string | Date, lang: InvoiceLang = "pt"): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, invoiceLocale[lang]?.dateFormat ?? "dd/MM/yyyy")
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

export async function generateInvoicePDF(params: InvoicePDFParams): Promise<ArrayBuffer> {
  const { invoice, items, job, client, settings, lang } = params
  const t = invoiceT[lang] ?? invoiceT.pt
  const cur = (v: number) => formatCurrencyPDF(v, invoice.currency, lang)
  const dt  = (d: string | Date) => formatDatePDF(d, lang)

  const billingMode = job?.billing_mode ?? "hourly"
  const isDaily     = billingMode === "daily"
  const isProject   = billingMode === "fixed"

  const accentColor = settings?.invoice_color ?? "#1e40af"
  const [r, g, b]   = hexToRgb(accentColor)

  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let logoBase64: string | null = null
  if (settings?.logo_url) {
    logoBase64 = await fetchImageBase64(settings.logo_url)
  }

  let headerOffsetY = 0
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 20, 12, 0, 16)
    headerOffsetY = 12
  }

  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(r, g, b)
  doc.text(t.invoice, 20, 25 + headerOffsetY)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text(`#${invoice.seq_number ?? invoice.invoice_number}`, 20, 33 + headerOffsetY)

  const metaX = pageW - 20
  let metaY = 20
  if (settings?.company_name) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text(settings.company_name, metaX, metaY, { align: "right" })
    metaY += 6
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
  }
  if (settings?.cnpj_cpf) {
    doc.setFontSize(9)
    doc.text(`CNPJ/CPF: ${settings.cnpj_cpf}`, metaX, metaY, { align: "right" })
    metaY += 5
  }
  doc.setFontSize(10)
  doc.text(`${t.date}: ${dt(new Date())}`, metaX, metaY, { align: "right" })
  metaY += 7
  doc.text(`${t.period}: ${dt(invoice.period_start)} – ${dt(invoice.period_end)}`, metaX, metaY, { align: "right" })
  if (invoice.due_date) {
    metaY += 7
    doc.text(`${t.dueDate}: ${dt(invoice.due_date)}`, metaX, metaY, { align: "right" })
  }

  const sectionY = 48 + headerOffsetY

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.to}:`, 20, sectionY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  const toMaxW = pageW / 2 - 30
  let toY = sectionY + 7
  const toLine = (text: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(bold ? 30 : 80, bold ? 30 : 80, bold ? 30 : 80)
    const lines = doc.splitTextToSize(text, toMaxW) as string[]
    doc.text(lines, 20, toY)
    toY += lines.length * 5
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
  }
  if (client?.billing_entity) {
    toLine(client.billing_entity, true)
    const billAddr = client.billing_address ?? client.address
    if (billAddr) toLine(billAddr)
    toY += 2
    toLine(client.legal_name ?? client.name)
    if (client.email) toLine(client.email)
  } else {
    toLine(client?.legal_name ?? client?.name ?? "—")
    if (client?.company && client.company !== (client.legal_name ?? "")) toLine(client.company)
    if (client?.cnpj)    toLine(`${t.cnpj}: ${client.cnpj}`)
    if (client?.address) toLine(client.address)
    if (client?.email)   toLine(client.email)
  }

  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.service}:`, pageW / 2, sectionY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text(job?.name ?? "—", pageW / 2, sectionY + 7)
  let serviceY = sectionY + 13
  if (job?.project_code) {
    doc.text(`${t.project}: ${job.project_code}`, pageW / 2, serviceY)
    serviceY += 6
  }
  if (invoice.po_number) {
    doc.text(`${t.purchaseOrder}: ${invoice.po_number}`, pageW / 2, serviceY)
    serviceY += 6
  }
  const rateValue = isProject ? (invoice.subtotal ?? 0) : isDaily ? (job?.daily_rate ?? 0) : (job?.hourly_rate ?? 0)
  doc.text(
    isProject ? `${t.rate}: ${cur(rateValue)}` : `${t.rate}: ${cur(rateValue)}/${isDaily ? t.day : t.hour}`,
    pageW / 2, serviceY,
  )

  const divY = Math.max(sectionY + 25, serviceY + 6, toY + 4)
  doc.setDrawColor(200, 200, 200)
  doc.line(20, divY, pageW - 20, divY)

  autoTable(doc, {
    startY: divY + 7,
    head: [[t.tableDate, t.tableDescription,
      isProject ? t.tableBilledProject : isDaily ? t.tableBilledDays : t.tableBilled,
      isProject ? t.tableRateProject : isDaily ? t.tableRateDay : t.tableRate,
      t.tableSubtotal]],
    body: items.map((item) => {
      if (item.is_manual) {
        const desc = [item.description, item.job_number ? `Job: ${item.job_number}` : null].filter(Boolean).join(" — ")
        return [dt(item.date), desc, String(item.quantity ?? 0), cur(item.rate), cur(item.subtotal)]
      }
      const q = resolveItemQuantity(item, billingMode)
      return [
        dt(item.date),
        item.description ?? (isProject ? t.projectUnit : isDaily ? t.day : t.hour),
        formatQuantity(q.quantity, q.unit, lang),
        cur(item.rate),
        cur(item.subtotal),
      ]
    }),
    margin: { left: 20, right: 20 },
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  })

  const finalY   = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  const totalsX  = pageW - 80
  const hasInTax = invoice.tax_rate > 0

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`${t.subtotal}:`, totalsX, finalY)
  doc.text(cur(invoice.subtotal), pageW - 20, finalY, { align: "right" })

  if (hasInTax) {
    doc.text(`${t.taxes} (${invoice.tax_rate}%):`, totalsX, finalY + 7)
    doc.text(cur(invoice.tax_amount), pageW - 20, finalY + 7, { align: "right" })
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.total}:`, totalsX, finalY + (hasInTax ? 17 : 10))
  doc.setTextColor(r, g, b)
  doc.text(cur(invoice.total), pageW - 20, finalY + (hasInTax ? 17 : 10), { align: "right" })

  let cursorY = finalY + (hasInTax ? 17 : 10) + 14

  const printLabelRows = (title: string, rows: Array<[string, string | null | undefined]>) => {
    const filled = rows.filter((row): row is [string, string] => !!row[1] && row[1].trim().length > 0)
    if (filled.length === 0) return
    const blockH = 8 + filled.length * 5.5
    if (cursorY + blockH > pageH - 20) { doc.addPage(); cursorY = 20 }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text(title, 20, cursorY)
    cursorY += 5.5
    doc.setFont("helvetica", "normal")
    for (const [label, value] of filled) {
      doc.setTextColor(120, 120, 120)
      doc.text(`${label}:`, 20, cursorY)
      doc.setTextColor(30, 30, 30)
      const lines = doc.splitTextToSize(value, pageW - 82) as string[]
      doc.text(lines, 62, cursorY)
      cursorY += 5.5 * lines.length
    }
    cursorY += 3
  }

  if (invoice.currency !== "BRL") {
    // Wire instructions in SWIFT field order (56 → 57 → 59), then the recipient's fiscal identity
    const s: Partial<NonNullable<InvoicePDFParams["settings"]>> = settings ?? {}
    const sections: Array<[string, Array<[string, string | null | undefined]>]> = [
      [t.intermediaryBank, [
        [t.swift,         s.intermediary_bank_swift],
        [t.routing,       s.intermediary_bank_aba],
        [t.accountNumber, s.intermediary_bank_account],
        [t.bankName,      s.intermediary_bank_name],
        [t.bankAddress,   s.intermediary_bank_address],
      ]],
      [t.destinationBank, [
        [t.swift,       s.bank_swift],
        [t.bankName,    s.bank_name],
        [t.bankAddress, s.bank_address],
      ]],
      [t.beneficiaryField, [
        [t.beneficiary,   s.bank_beneficiary ?? s.legal_name],
        [t.iban,          s.bank_iban],
        [t.accountNumber, s.bank_account_number],
        [t.routing,       s.bank_routing],
        [t.accountType,   s.bank_account_type],
      ]],
    ]
    const hasWire = sections.some(([, rows]) => rows.some((row) => !!row[1] && row[1].trim().length > 0))
    if (hasWire) {
      if (cursorY + 20 > pageH - 20) { doc.addPage(); cursorY = 20 }
      doc.setDrawColor(200, 200, 200)
      doc.line(20, cursorY, pageW - 20, cursorY)
      cursorY += 8
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.text(t.paymentInstructions, 20, cursorY)
      cursorY += 7
      for (const [title, rows] of sections) printLabelRows(title, rows)
    }
    const recipientLines = [
      s.legal_name ?? s.company_name,
      s.cnpj_cpf ? `${t.cnpj}: ${s.cnpj_cpf}` : null,
      s.fiscal_address,
    ].filter((v): v is string => !!v && v.trim().length > 0)
    if (recipientLines.length > 0) {
      const wrapped = recipientLines.flatMap((l) => doc.splitTextToSize(l, pageW - 40) as string[])
      const blockH = 8 + wrapped.length * 5
      if (cursorY + blockH > pageH - 20) { doc.addPage(); cursorY = 20 }
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(t.recipientInfo, 20, cursorY)
      cursorY += 5.5
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      doc.text(wrapped, 20, cursorY)
      cursorY += wrapped.length * 5 + 4
    }
  }

  // Payment details block (PIX for BRL)
  const bankRows = invoice.currency === "BRL" ? paymentDetailRows(settings, invoice.currency, lang) : []
  if (bankRows.length > 0) {
    const blockH = 14 + bankRows.length * 6
    if (cursorY + blockH > pageH - 20) { doc.addPage(); cursorY = 20 }

    doc.setDrawColor(200, 200, 200)
    doc.line(20, cursorY, pageW - 20, cursorY)
    cursorY += 8

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text(t.paymentDetails, 20, cursorY)
    cursorY += 6

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    for (const [label, value] of bankRows) {
      doc.setTextColor(120, 120, 120)
      doc.text(`${label}:`, 20, cursorY)
      doc.setTextColor(30, 30, 30)
      doc.text(value, 62, cursorY)
      cursorY += 6
    }
    cursorY += 4
  }

  if (invoice.notes) {
    if (cursorY + 10 > pageH - 20) { doc.addPage(); cursorY = 20 }
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    const lines = doc.splitTextToSize(`${t.notes}: ${invoice.notes}`, pageW - 40) as string[]
    doc.text(lines, 20, cursorY)
  }

  return doc.output("arraybuffer")
}
