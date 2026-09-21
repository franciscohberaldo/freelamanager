import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { type InvoiceLang } from "@/lib/invoice-i18n"
import { buildInvoiceEmail, resolveRecipients } from "@/lib/invoice-email"

/** What the send dialog shows before anything leaves: recipients, subject and body. */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoiceId")
  const lang: InvoiceLang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "pt"
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, jobs(name, currency, billing_mode, project_code, clients(id, name, email))")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const job = invoice.jobs as { name: string; currency: string; billing_mode: "hourly" | "daily" | "fixed"; project_code: string | null; clients: { id: string; name: string; email: string | null } | null } | null

  const { data: contacts } = await supabase
    .from("client_contacts")
    .select("email")
    .eq("client_id", job?.clients?.id ?? "")
    .eq("cc_invoices", true)

  const { to, cc } = resolveRecipients(job?.clients?.email, (contacts ?? []).map(c => c.email))

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("date")

  const { subject, html } = buildInvoiceEmail({ invoice, items: items ?? [], job, lang })

  return NextResponse.json({ to, cc, subject, html })
}
