import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { buildNfRequest } from "@/lib/nf-request"
import { assertTransition, type NfStatus } from "@/lib/nf-status"
import type { UserSettings } from "@/lib/supabase/types"

const INVOICE_SELECT = "id, seq_number, invoice_number, currency, total, due_date, nf_status, nf_amount_brl, jobs(name, nf_description, po_number, clients(name, legal_name, cnpj, state_registration, address, nf_rules))"

type InvoiceRow = {
  id: string; seq_number: string | null; invoice_number: string; currency: string; total: number
  due_date: string | null; nf_status: string; nf_amount_brl: number | null
  jobs: {
    name: string; nf_description: string | null; po_number: string | null
    clients: {
      name: string; legal_name: string | null; cnpj: string | null
      state_registration: string | null; address: string | null; nf_rules: string | null
    } | null
  } | null
}

async function loadInvoice(invoiceId: string, userId: string) {
  const supabase = await createClient()
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select(INVOICE_SELECT).eq("id", invoiceId).eq("user_id", userId).single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
  ])
  return { supabase, invoice: invoice as unknown as InvoiceRow | null, settings: settings as UserSettings | null }
}

function buildFromInvoice(invoice: InvoiceRow) {
  const job = invoice.jobs
  const client = job?.clients ?? null
  const amountBrl = invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : 0)
  const built = buildNfRequest({
    clientName: client?.name ?? job?.name ?? "Cliente",
    legalName: client?.legal_name ?? null,
    address: client?.address ?? null,
    cnpj: client?.cnpj ?? null,
    stateRegistration: client?.state_registration ?? null,
    nfDescription: job?.nf_description ?? null,
    poNumber: job?.po_number ?? null,
    amountBrl,
    dueDate: invoice.due_date,
    nfRules: client?.nf_rules ?? null,
  })
  return { ...built, amountBrl }
}

/** Send the request to the accountant, log it in nf_requests and move the invoice to "requested". */
export async function POST(request: NextRequest) {
  const { invoiceId, subject: customSubject, body: customBody } = await request.json().catch(() => ({}))
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { supabase, invoice, settings } = await loadInvoice(invoiceId, user.id)
  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })
  if (!settings?.accountant_email) return NextResponse.json({ error: "Cadastre o e-mail do contador em Configurações" }, { status: 400 })

  try { assertTransition(invoice.nf_status as NfStatus, "requested") }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }) }

  const built = buildFromInvoice(invoice)
  if (!built.amountBrl) return NextResponse.json({ error: "Valor em reais da NF não definido" }, { status: 400 })

  const subject = typeof customSubject === "string" && customSubject.trim() ? customSubject : built.subject
  const body    = typeof customBody === "string" && customBody.trim() ? customBody : built.body

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sent, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to: [settings.accountant_email],
    subject,
    text: body,
  })

  const { data: req } = await supabase.from("nf_requests").insert({
    user_id: user.id, invoice_id: invoice.id, sent_to: settings.accountant_email, subject, body,
    resend_id: sent?.id ?? null, status: error ? "failed" : "sent", error: error?.message ?? null,
  }).select("id").single()

  if (error) return NextResponse.json({ error: error.message, requestId: req?.id }, { status: 502 })

  await supabase.from("invoices").update({ nf_status: "requested", nf_requested_at: new Date().toISOString() }).eq("id", invoice.id)
  return NextResponse.json({ ok: true, requestId: req?.id })
}

/** Preview the e-mail without sending. */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoiceId")
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { invoice, settings } = await loadInvoice(invoiceId, user.id)
  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })

  const { subject, body } = buildFromInvoice(invoice)
  return NextResponse.json({ subject, body, to: settings?.accountant_email ?? null })
}
