import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { type InvoiceLang } from "@/lib/invoice-i18n"
import { buildInvoiceEmail, resolveRecipients } from "@/lib/invoice-email"
import { invoicePdfFileName } from "@/lib/invoice-pdf-server"
import { quiet } from "@/lib/invoice-pdf"

/** What the send dialog opens with: recipients, subject, the editable message and the PDF's name. */
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

  const { data: settings } = await supabase
    .from("user_settings")
    .select("legal_name, company_name")
    .eq("user_id", user.id)
    .single()
  const senderName = quiet(settings?.legal_name || settings?.company_name || "") || null

  const { subject, text } = buildInvoiceEmail({ invoice, job, lang, senderName })

  return NextResponse.json({ to, cc, subject, text, fileName: invoicePdfFileName(invoice) })
}
