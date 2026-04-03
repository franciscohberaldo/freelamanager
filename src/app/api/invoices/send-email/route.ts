import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { format, parseISO } from "date-fns"

function formatCurrency(value: number, currency: string = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)
}

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, jobs(name, currency, clients(name, email))")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const job = invoice.jobs as { name: string; currency: string; clients: { name: string; email: string | null } | null } | null
  const clientEmail = job?.clients?.email

  if (!clientEmail) {
    return NextResponse.json({ error: "Cliente sem e-mail cadastrado" }, { status: 400 })
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("date")

  const itemsHtml = items?.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${format(parseISO(item.date), "dd/MM/yyyy")}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.hours_billed}h</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.rate, invoice.currency)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${formatCurrency(item.subtotal, invoice.currency)}</td>
    </tr>
  `).join("") ?? ""

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:24px">Invoice #${invoice.invoice_number}</h1>
        <p style="margin:4px 0 0;opacity:0.8">
          ${format(parseISO(invoice.period_start), "dd/MM/yyyy")} – ${format(parseISO(invoice.period_end), "dd/MM/yyyy")}
        </p>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:none">
        <p>Olá, ${job?.clients?.name ?? ""},</p>
        <p>Segue o invoice referente ao período de ${format(parseISO(invoice.period_start), "dd/MM/yyyy")} a ${format(parseISO(invoice.period_end), "dd/MM/yyyy")} pelo serviço <strong>${job?.name ?? ""}</strong>.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead>
            <tr style="background:#f5f7ff">
              <th style="padding:10px 8px;text-align:left;border-bottom:2px solid #1e40af">Data</th>
              <th style="padding:10px 8px;text-align:center;border-bottom:2px solid #1e40af">Horas</th>
              <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #1e40af">Taxa/h</th>
              <th style="padding:10px 8px;text-align:right;border-bottom:2px solid #1e40af">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align:right;padding-top:12px;border-top:2px solid #eee">
          <p style="margin:4px 0">Subtotal: <strong>${formatCurrency(invoice.subtotal, invoice.currency)}</strong></p>
          ${invoice.tax_rate > 0 ? `<p style="margin:4px 0">Impostos (${invoice.tax_rate}%): <strong>${formatCurrency(invoice.tax_amount, invoice.currency)}</strong></p>` : ""}
          <p style="font-size:18px;color:#1e40af;margin:8px 0 0">
            <strong>TOTAL: ${formatCurrency(invoice.total, invoice.currency)}</strong>
          </p>
        </div>

        ${invoice.notes ? `<p style="margin-top:20px;color:#666;font-size:13px">Notas: ${invoice.notes}</p>` : ""}
      </div>
    </div>
  `

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to: [clientEmail],
    subject: `Invoice #${invoice.invoice_number} — ${job?.name ?? "Freela Manager"}`,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark as sent
  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)

  return NextResponse.json({ success: true })
}
