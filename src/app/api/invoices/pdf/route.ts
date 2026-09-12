import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { generateInvoicePDF } from "@/lib/invoice-pdf"
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
      .select("*, jobs(name, hourly_rate, daily_rate, billing_mode, project_code, currency, clients(name, company, email))")
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
    name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily"; project_code: string | null; currency: string
    clients: { name: string; company: string | null; email: string | null } | null
  } | null
  const client = job?.clients ?? null

  const pdfBytes = await generateInvoicePDF({
    invoice,
    items: items ?? [],
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
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
