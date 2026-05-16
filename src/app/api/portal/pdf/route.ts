import { NextRequest, NextResponse } from "next/server"
import { validatePortalToken } from "@/lib/portal-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateInvoicePDF } from "@/lib/invoice-pdf"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")
  const invoiceId = searchParams.get("invoice_id")

  if (!token || !invoiceId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  }

  const auth = await validatePortalToken(token)
  if (!auth) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = createAdminClient()

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*, jobs(*, clients(*))")
    .eq("id", invoiceId)
    .eq("user_id", auth.user_id)
    .single()

  if (invError || !invoice) {
    return new NextResponse(null, { status: 404 })
  }

  const job = invoice.jobs as unknown as { id: string; name: string; hourly_rate: number; currency: string; client_id: string; clients: { id: string; name: string; company: string | null; email: string | null } }

  if (job.client_id !== auth.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("date, hours_billed, rate, subtotal")
    .eq("invoice_id", invoiceId)
    .order("date")

  const { data: settings } = await supabase
    .from("user_settings")
    .select("company_name, cnpj_cpf, logo_url, invoice_color")
    .eq("user_id", auth.user_id)
    .single()

  const pdfBuffer = await generateInvoicePDF({
    invoice: {
      invoice_number: invoice.invoice_number,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
      due_date: invoice.due_date,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      tax_rate: invoice.tax_rate,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      notes: invoice.notes,
    },
    items: items ?? [],
    job: { name: job.name, hourly_rate: job.hourly_rate, currency: job.currency },
    client: { name: job.clients.name, company: job.clients.company, email: job.clients.email },
    settings: settings
      ? { company_name: settings.company_name, cnpj_cpf: settings.cnpj_cpf, logo_url: settings.logo_url, invoice_color: settings.invoice_color }
      : null,
    lang: "pt",
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
