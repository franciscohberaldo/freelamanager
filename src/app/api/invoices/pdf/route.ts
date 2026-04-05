import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format, parseISO } from "date-fns"
import { invoiceT, type InvoiceLang } from "@/lib/invoice-i18n"

function formatCurrencyPDF(value: number, currency: string = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

async function fetchImageBase64(url: string): Promise<string | null> {
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

export async function GET(request: NextRequest) {
  const id   = request.nextUrl.searchParams.get("id")
  const lang = (request.nextUrl.searchParams.get("lang") ?? "pt") as InvoiceLang
  const t    = invoiceT[lang] ?? invoiceT.pt

  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, jobs(name, hourly_rate, currency, clients(name, company, email))")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_settings")
      .select("company_name, cnpj_cpf, logo_url, invoice_color")
      .eq("user_id", user.id)
      .single(),
  ])

  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("date")

  const job    = invoice.jobs as { name: string; hourly_rate: number; currency: string; clients: { name: string; company: string | null; email: string | null } | null } | null
  const client = job?.clients

  const accentColor = settings?.invoice_color ?? "#1e40af"
  const [r, g, b]   = hexToRgb(accentColor)

  const doc   = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()

  // Logo (if provided)
  let logoBase64: string | null = null
  if (settings?.logo_url) {
    logoBase64 = await fetchImageBase64(settings.logo_url)
  }

  let headerOffsetY = 0
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 20, 12, 0, 16)
    headerOffsetY = 12
  }

  // Header — "INVOICE" title
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(r, g, b)
  doc.text(t.invoice, 20, 25 + headerOffsetY)

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text(`#${invoice.invoice_number}`, 20, 33 + headerOffsetY)

  // Sender info (company name + CNPJ) on the right
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
  doc.text(`${t.date}: ${format(new Date(), "dd/MM/yyyy")}`, metaX, metaY, { align: "right" })
  metaY += 7
  doc.text(
    `${t.period}: ${format(parseISO(invoice.period_start), "dd/MM/yyyy")} – ${format(parseISO(invoice.period_end), "dd/MM/yyyy")}`,
    metaX, metaY, { align: "right" }
  )
  if (invoice.due_date) {
    metaY += 7
    doc.text(`${t.dueDate}: ${format(parseISO(invoice.due_date), "dd/MM/yyyy")}`, metaX, metaY, { align: "right" })
  }

  const sectionY = 48 + headerOffsetY

  // Client info
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.to}:`, 20, sectionY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text(client?.name ?? "—", 20, sectionY + 7)
  if (client?.company) doc.text(client.company, 20, sectionY + 13)
  if (client?.email)   doc.text(client.email,   20, client?.company ? sectionY + 19 : sectionY + 13)

  // Service info
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.service}:`, pageW / 2, sectionY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text(job?.name ?? "—", pageW / 2, sectionY + 7)
  doc.text(`${t.rate}: ${formatCurrencyPDF(job?.hourly_rate ?? 0, invoice.currency)}/${t.hour}`, pageW / 2, sectionY + 13)

  // Divider
  const divY = sectionY + 25
  doc.setDrawColor(200, 200, 200)
  doc.line(20, divY, pageW - 20, divY)

  // Items table
  autoTable(doc, {
    startY: divY + 7,
    head: [[t.tableDate, t.tableBilled, t.tableRate, t.tableSubtotal]],
    body: items?.map((item) => [
      format(parseISO(item.date), "dd/MM/yyyy"),
      `${item.hours_billed}h`,
      formatCurrencyPDF(item.rate, invoice.currency),
      formatCurrencyPDF(item.subtotal, invoice.currency),
    ]) ?? [],
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
  })

  const finalY   = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  const totalsX  = pageW - 80
  const hasInTax = invoice.tax_rate > 0

  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`${t.subtotal}:`, totalsX, finalY)
  doc.text(formatCurrencyPDF(invoice.subtotal, invoice.currency), pageW - 20, finalY, { align: "right" })

  if (hasInTax) {
    doc.text(`${t.taxes} (${invoice.tax_rate}%):`, totalsX, finalY + 7)
    doc.text(formatCurrencyPDF(invoice.tax_amount, invoice.currency), pageW - 20, finalY + 7, { align: "right" })
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text(`${t.total}:`, totalsX, finalY + (hasInTax ? 17 : 10))
  doc.setTextColor(r, g, b)
  doc.text(formatCurrencyPDF(invoice.total, invoice.currency), pageW - 20, finalY + (hasInTax ? 17 : 10), { align: "right" })

  if (invoice.notes) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text(`${t.notes}: ${invoice.notes}`, 20, finalY + 30)
  }

  const pdfBytes = doc.output("arraybuffer")
  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
