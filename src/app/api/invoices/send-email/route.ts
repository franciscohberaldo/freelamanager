import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { invoiceT, formatInvoiceCurrency, formatQuantity, type InvoiceLang } from "@/lib/invoice-i18n"
import { formatDatePDF, resolveItemQuantity } from "@/lib/invoice-pdf"

export async function POST(request: NextRequest) {
  const { invoiceId, lang: rawLang = "pt" } = await request.json()
  const lang: InvoiceLang = rawLang === "en" ? "en" : "pt"
  const t = invoiceT[lang]
  const formatCurrency = (value: number, currency: string) => formatInvoiceCurrency(value, currency, lang)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, jobs(name, currency, billing_mode, project_code, clients(name, email))")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const job         = invoice.jobs as { name: string; currency: string; billing_mode: "hourly" | "daily"; project_code: string | null; clients: { name: string; email: string | null } | null } | null
  const clientEmail = job?.clients?.email
  const isDaily     = job?.billing_mode === "daily"

  if (!clientEmail) {
    return NextResponse.json({ error: "Cliente sem e-mail cadastrado" }, { status: 400 })
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("date")

  const periodStart = formatDatePDF(invoice.period_start, lang)
  const periodEnd   = formatDatePDF(invoice.period_end, lang)
  const jobLabel    = job?.project_code ? `${job.name} (${job.project_code})` : (job?.name ?? "")

  const itemsHtml = items?.map((item) => {
    const q = resolveItemQuantity(item, job?.billing_mode ?? "hourly")
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${formatDatePDF(item.date, lang)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${formatQuantity(q.quantity, q.unit, lang)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.rate, invoice.currency)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${formatCurrency(item.subtotal, invoice.currency)}</td>
    </tr>
  `}).join("") ?? ""

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
              <th style="padding:10px 8px;text-align:center;border-bottom:2px solid #1e40af">${isDaily ? t.emailDays : t.emailHours}</th>
              <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #1e40af">${isDaily ? t.emailRateDay : t.emailRate}</th>
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

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to: [clientEmail],
    subject: t.subject(invoice.invoice_number, job?.name ?? "Freela Manager"),
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)

  return NextResponse.json({ success: true })
}
