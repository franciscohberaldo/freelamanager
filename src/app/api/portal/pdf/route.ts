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

  const job = invoice.jobs as unknown as {
    id: string; name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"; project_code: string | null
    currency: string; client_id: string
    clients: {
      id: string; name: string; company: string | null; email: string | null
      legal_name: string | null; cnpj: string | null; address: string | null; billing_entity: string | null; billing_address: string | null
    }
  }

  if (job.client_id !== auth.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("date, hours_billed, rate, subtotal, quantity, unit, description, job_number, is_manual")
    .eq("invoice_id", invoiceId)
    .order("date")

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", auth.user_id)
    .single()

  const pdfBuffer = await generateInvoicePDF({
    invoice: {
      invoice_number: invoice.invoice_number,
      seq_number: invoice.seq_number,
      po_number: invoice.po_number,
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
    job: {
      name: job.name, hourly_rate: job.hourly_rate, daily_rate: job.daily_rate,
      billing_mode: job.billing_mode, project_code: job.project_code, currency: job.currency,
    },
    client: {
      name: job.clients.name, company: job.clients.company, email: job.clients.email,
      legal_name: job.clients.legal_name, cnpj: job.clients.cnpj, address: job.clients.address,
      billing_entity: job.clients.billing_entity, billing_address: job.clients.billing_address,
    },
    settings: settings ?? null,
    // Foreign-currency invoices are presented in English on the client portal
    lang: invoice.currency === "BRL" ? "pt" : "en",
  })

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.seq_number ?? invoice.invoice_number}.pdf"`,
    },
  })
}
