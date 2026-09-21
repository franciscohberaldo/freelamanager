import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { type InvoiceLang } from "@/lib/invoice-i18n"
import { buildInvoiceEmail, resolveRecipients } from "@/lib/invoice-email"
import { parseEmails, isValidEmail } from "@/lib/emails"

export async function POST(request: NextRequest) {
  const { invoiceId, lang: rawLang = "pt", subject: subjectOverride, extraTo } = await request.json()
  const lang: InvoiceLang = rawLang === "en" ? "en" : "pt"

  // One-off recipients typed in the send dialog, comma-separated like the client's field.
  const extras = parseEmails(typeof extraTo === "string" ? extraTo : "")
  const bad = extras.find(e => !isValidEmail(e))
  if (bad) return NextResponse.json({ error: `"${bad}" não parece um e-mail` }, { status: 400 })

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
  for (const e of extras) {
    if (!to.includes(e) && !cc.includes(e)) to.push(e)
  }

  if (to.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário para a invoice: preencha o e-mail do cliente ou marque um contato para receber as invoices" }, { status: 400 })
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("date")

  const { subject, html } = buildInvoiceEmail({ invoice, items: items ?? [], job, lang })
  const finalSubject = typeof subjectOverride === "string" && subjectOverride.trim()
    ? subjectOverride.trim()
    : subject

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to,
    ...(cc.length > 0 ? { cc } : {}),
    subject: finalSubject,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)

  return NextResponse.json({ success: true })
}
