import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { generateInvoicePDF, type InvoicePDFParams } from "@/lib/invoice-pdf"
import { itemsFromLogs } from "@/lib/invoice-items"
import type { InvoiceLang } from "@/lib/invoice-i18n"

export async function GET(request: NextRequest) {
  const id   = request.nextUrl.searchParams.get("id")
  const lang = (request.nextUrl.searchParams.get("lang") ?? "pt") as InvoiceLang

  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, jobs(name, hourly_rate, daily_rate, billing_mode, project_code, currency, contract_value, clients(name, company, email, legal_name, cnpj, address, billing_entity, billing_address))")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ])

  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("date")

  const job    = invoice.jobs as {
    name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"; project_code: string | null; currency: string; contract_value: number | null
    clients: {
      name: string; company: string | null; email: string | null
      legal_name: string | null; cnpj: string | null; address: string | null; billing_entity: string | null; billing_address: string | null
    } | null
  } | null
  const client = job?.clients ?? null

  // An invoice without stored items still owes the client the worked days.
  let itemRows: InvoicePDFParams["items"] = items ?? []
  if (itemRows.length === 0 && job) {
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("date, hours_billed, total_value")
      .eq("job_id", invoice.job_id)
      .gte("date", invoice.period_start)
      .lte("date", invoice.period_end)
      .order("date")
    itemRows = itemsFromLogs(logs ?? [], job, invoice)
  }

  const pdfBytes = await generateInvoicePDF({
    invoice,
    items: itemRows,
    job: job ? {
      name: job.name, hourly_rate: job.hourly_rate, daily_rate: job.daily_rate,
      billing_mode: job.billing_mode, project_code: job.project_code, currency: job.currency,
    } : null,
    client,
    settings,
    lang,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.seq_number ?? invoice.invoice_number}.pdf"`,
    },
  })
}
