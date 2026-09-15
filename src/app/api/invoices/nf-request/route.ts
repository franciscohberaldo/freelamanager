import { createClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { buildNfRequest, buildBankBlock } from "@/lib/nf-request"
import { assertTransition, type NfStatus } from "@/lib/nf-status"
import { replyAddress } from "@/lib/inbound-email"
import type { UserSettings } from "@/lib/supabase/types"

const INVOICE_SELECT = "id, seq_number, invoice_number, currency, total, due_date, nf_status, nf_amount_brl, jobs(name, nf_description, po_number, clients(name, legal_name, cnpj, state_registration, address, nf_rules))"

/** What the tomador's block of the e-mail is written from. */
type ClientFiscal = {
  name: string; legal_name: string | null; cnpj: string | null
  state_registration: string | null; address: string | null; nf_rules: string | null
}

type InvoiceRow = {
  id: string; seq_number: string | null; invoice_number: string; currency: string; total: number
  due_date: string | null; nf_status: string; nf_amount_brl: number | null
  jobs: {
    name: string; nf_description: string | null; po_number: string | null
    clients: ClientFiscal | null
  } | null
}

const JOB_SELECT = "id, name, nf_description, po_number, contract_value, currency, end_date, clients(name, legal_name, cnpj, state_registration, address, nf_rules)"

type JobRow = {
  id: string; name: string; nf_description: string | null; po_number: string | null
  contract_value: number | null; currency: string; end_date: string | null
  clients: ClientFiscal | null
}

async function loadInvoice(invoiceId: string, userId: string) {
  const supabase = await createClient()
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select(INVOICE_SELECT).eq("id", invoiceId).eq("user_id", userId).single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
  ])
  return { supabase, invoice: invoice as unknown as InvoiceRow | null, settings: settings as UserSettings | null }
}

async function loadJob(jobId: string, userId: string) {
  const supabase = await createClient()
  const [{ data: job }, { data: settings }] = await Promise.all([
    supabase.from("jobs").select(JOB_SELECT).eq("id", jobId).eq("user_id", userId).single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
  ])
  return { supabase, job: job as unknown as JobRow | null, settings: settings as UserSettings | null }
}

/** A job pays for its own request: the closed price and the end date stand in for an invoice. */
function buildFromJob(job: JobRow, settings: UserSettings | null) {
  const client = job.clients
  const amountBrl = job.currency === "BRL" ? (job.contract_value ?? 0) : 0
  const built = buildNfRequest({
    companyName: settings?.company_name ?? settings?.legal_name ?? null,
    clientName: client?.name ?? job.name,
    legalName: client?.legal_name ?? null,
    address: client?.address ?? null,
    cnpj: client?.cnpj ?? null,
    stateRegistration: client?.state_registration ?? null,
    nfDescription: job.nf_description ?? null,
    poNumber: job.po_number ?? null,
    amountBrl,
    dueDate: job.end_date,
    nfRules: client?.nf_rules ?? null,
  })
  return { ...built, amountBrl }
}

function buildFromInvoice(invoice: InvoiceRow, settings: UserSettings | null) {
  const job = invoice.jobs
  const client = job?.clients ?? null
  const amountBrl = invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : 0)
  const built = buildNfRequest({
    companyName: settings?.company_name ?? settings?.legal_name ?? null,
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
  const { invoiceId, jobId, subject: customSubject, body: customBody } = await request.json().catch(() => ({}))
  if (!invoiceId && !jobId) return NextResponse.json({ error: "invoiceId ou jobId obrigatório" }, { status: 400 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const loaded = invoiceId
    ? await loadInvoice(invoiceId, user.id)
    : await loadJob(jobId, user.id)
  const invoice = "invoice" in loaded ? loaded.invoice : null
  const job = "job" in loaded ? loaded.job : null
  const { supabase, settings } = loaded
  if (invoiceId && !invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })
  if (jobId && !job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })
  if (!settings?.accountant_email) return NextResponse.json({ error: "Cadastre o e-mail do contador em Configurações" }, { status: 400 })

  if (invoice) {
    try { assertTransition(invoice.nf_status as NfStatus, "requested") }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }) }
  }

  const built = invoice ? buildFromInvoice(invoice, settings) : buildFromJob(job!, settings)
  if (!built.amountBrl) {
    // The NF is always in reais; a job in another currency only knows that figure once an
    // invoice has been paid and its nf_amount_brl recorded.
    const why = invoice ? "Valor em reais da NF não definido"
      : job!.currency !== "BRL"
        ? `O job é em ${job!.currency}: o valor da NF em reais vem da invoice, crie uma para pedir a NF`
        : "Defina o valor do contrato do job para pedir a NF"
    return NextResponse.json({ error: why }, { status: 400 })
  }

  const subject = typeof customSubject === "string" && customSubject.trim() ? customSubject : built.subject
  const body    = typeof customBody === "string" && customBody.trim() ? customBody : built.body

  // The id is drawn before sending so the reply comes back addressed to this very request.
  const requestId = randomUUID()
  const replyTo = replyAddress(requestId, process.env.RESEND_INBOUND_DOMAIN)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sent, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to: [settings.accountant_email],
    replyTo: replyTo ?? undefined,
    subject,
    text: body,
  })

  const { data: req } = await supabase.from("nf_requests").insert({
    id: requestId,
    user_id: user.id,
    invoice_id: invoice?.id ?? null,
    job_id: job?.id ?? null,
    sent_to: settings.accountant_email, reply_to: replyTo, subject, body,
    resend_id: sent?.id ?? null, status: error ? "failed" : "sent", error: error?.message ?? null,
  }).select("id").single()

  if (error) return NextResponse.json({ error: error.message, requestId: req?.id }, { status: 502 })

  // Only an invoice carries the NF's lifecycle; a request made from the job just goes out.
  if (invoice) {
    await supabase.from("invoices")
      .update({ nf_status: "requested", nf_requested_at: new Date().toISOString() })
      .eq("id", invoice.id)
  }
  return NextResponse.json({ ok: true, requestId: req?.id })
}

/**
 * The account the accountant may be asked to print. The currency says where the tomador
 * is: one billed in reais pays here, one billed in dollars or euros wires from abroad.
 */
const bankBlockOf = (settings: UserSettings | null, currency: string) => buildBankBlock({
  domestic: {
    beneficiary: settings?.bank_beneficiary ?? null,
    bankName: settings?.br_bank_name ?? null,
    agency: settings?.br_bank_agency ?? null,
    account: settings?.br_bank_account ?? null,
    pixKey: settings?.pix_key ?? null,
  },
  wire: {
    beneficiary: settings?.bank_beneficiary ?? null,
    bankName: settings?.bank_name ?? null,
    accountType: settings?.bank_account_type ?? null,
    account: settings?.bank_account_number ?? null,
    routing: settings?.bank_routing ?? null,
    swift: settings?.bank_swift ?? null,
    iban: settings?.bank_iban ?? null,
    address: settings?.bank_address ?? null,
  },
  intermediary: {
    bankName: settings?.intermediary_bank_name ?? null,
    swift: settings?.intermediary_bank_swift ?? null,
    aba: settings?.intermediary_bank_aba ?? null,
    account: settings?.intermediary_bank_account ?? null,
    address: settings?.intermediary_bank_address ?? null,
  },
  fx: {
    bankName: settings?.fx_bank_name ?? null,
    agency: settings?.fx_bank_agency ?? null,
    account: settings?.fx_bank_account ?? null,
    swift: settings?.fx_bank_swift ?? null,
  },
}, { abroad: currency !== "BRL" })

/** Preview the e-mail without sending. */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoiceId")
  const jobId = request.nextUrl.searchParams.get("jobId")
  if (!invoiceId && !jobId) return NextResponse.json({ error: "invoiceId ou jobId obrigatório" }, { status: 400 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  if (invoiceId) {
    const { invoice, settings } = await loadInvoice(invoiceId, user.id)
    if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })
    const { subject, body } = buildFromInvoice(invoice, settings)
    return NextResponse.json({
      subject, body, to: settings?.accountant_email ?? null, bankBlock: bankBlockOf(settings, invoice.currency),
    })
  }

  const { job, settings } = await loadJob(jobId!, user.id)
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })
  const { subject, body } = buildFromJob(job, settings)
  return NextResponse.json({
    subject, body, to: settings?.accountant_email ?? null, bankBlock: bankBlockOf(settings, job.currency),
  })
}
