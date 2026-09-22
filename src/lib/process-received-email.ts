/**
 * The whole life of a received e-mail, shared by the webhook and the hourly poll: fetch it
 * from Resend, match it to the NF request it answers, file its PDF as the job's NF, and
 * record it in the owner's inbox.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { requestIdFrom, isNfAttachment, inboxAttachmentPath } from "@/lib/inbound-email"
import { DOCUMENT_BUCKET, documentPath } from "@/lib/job-documents"
import { nfseLinkFrom, downloadNfsePdf, notaInfoFromPdf } from "@/lib/nfse-prefeitura"
import { jobDraftFromPdf, type JobDraft } from "@/lib/job-from-pdf"
import {
  ACCOUNTING_BUCKET, ACCOUNTING_LABELS, accountingPath,
  competenciaFromName, formatCompetencia, kindFromName, type AccountingKind,
} from "@/lib/accounting-documents"
import { billingInfoFromPdf } from "@/lib/billing-pdf"
import { randomUUID } from "crypto"

const RESEND_API = "https://api.resend.com"

type AdminClient = ReturnType<typeof createAdminClient>

/** Kinds that ask for money: they deserve a reminder on the due date. */
const PAYABLE_KINDS: ReadonlySet<AccountingKind> = new Set(["fee_receipt", "das_guide", "dasn_guide", "tfe"])

/**
 * A PDF that is not a job's NF may still be the company's own paperwork — the accountant's
 * fee receipt, a DAS guide. The file name says what it is and which month it belongs to;
 * the PDF itself says how much and until when. Payable ones also land on the agenda.
 */
async function fileAccountingDocument(
  supabase: AdminClient, userId: string, name: string, bytes: Buffer,
): Promise<string | null> {
  const kind = kindFromName(name)
  const hit = competenciaFromName(name)
  if (!kind || !hit) return null

  const label = ACCOUNTING_LABELS[kind]
  const comp = formatCompetencia(hit.competencia, hit.scope)
  const competenciaDate = `${hit.competencia}-01` // the column is a date; the month is its 1st

  const { data: existing } = await supabase.from("accounting_documents").select("id")
    .eq("user_id", userId).eq("competencia", competenciaDate).eq("kind", kind).eq("file_name", name)
    .limit(1)
  if (existing?.length) return `${label} ${comp} já estava arquivado`

  const info = await billingInfoFromPdf(bytes)
  const path = accountingPath(userId, hit.competencia, kind, randomUUID(), name)
  const { error: upload } = await supabase.storage
    .from(ACCOUNTING_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf" })
  if (upload) return `Erro ao arquivar ${label}: ${upload.message}`

  const { error: insert } = await supabase.from("accounting_documents").insert({
    user_id: userId, competencia: competenciaDate, scope: hit.scope, kind,
    path, file_name: name, mime_type: "application/pdf",
    size_bytes: bytes.length, amount: info.amount,
  })
  if (insert) return `Erro ao registrar ${label}: ${insert.message}`

  let reminder = ""
  if (info.dueDate && PAYABLE_KINDS.has(kind)) {
    const title = `Pagar ${label.toLowerCase()} ${comp}`
    const { data: dup } = await supabase.from("agenda_events").select("id")
      .eq("user_id", userId).eq("title", title).eq("event_date", info.dueDate).limit(1)
    if (!dup?.length) {
      await supabase.from("agenda_events").insert({
        user_id: userId, title, type: "payment", event_date: info.dueDate,
        description: `Vencimento extraído de "${name}".`,
        priority: "high", budget: info.amount,
      })
      reminder = ` — lembrete criado para ${info.dueDate.split("-").reverse().join("/")}`
    }
  }
  return `${label} arquivado em ${comp}${reminder}`
}

export type ReceivedEmail = {
  id: string
  from: string
  to: string[] | null
  cc: string[] | null
  reply_to: string[] | null
  received_for: string[] | null
  subject: string | null
  text: string | null
  html: string | null
  attachments: { id: string; filename: string | null; content_type: string | null; size: number | null }[] | null
}

/** Forwards often arrive with no plain-text part; the HTML one stands in, stripped. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** The body worth showing: the plain-text part, or the HTML one stripped. */
export function bodyOf(email: { text: string | null; html: string | null }): string | null {
  if (email.text?.trim()) return email.text
  if (email.html?.trim()) return htmlToText(email.html)
  return null
}

const auth = () => ({ Authorization: `Bearer ${process.env.RESEND_API_KEY}` })

export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}`, { headers: auth() })
  return res.ok ? (await res.json()) as ReceivedEmail : null
}

/**
 * The webhook carries only the attachment's metadata, so its bytes are asked for separately
 * and fetched from a link that lives for an hour.
 */
async function downloadAttachment(emailId: string, attachmentId: string): Promise<Buffer | null> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}/attachments/${attachmentId}`, { headers: auth() })
  if (!res.ok) return null
  const { download_url } = await res.json() as { download_url?: string }
  if (!download_url) return null
  const file = await fetch(download_url)
  return file.ok ? Buffer.from(await file.arrayBuffer()) : null
}

/**
 * A PDF that is neither a job's NF nor accounting paperwork may be new work arriving. The
 * job starts as a proposal — the owner reviews it before it becomes active.
 */
async function createJobFromDraft(
  supabase: AdminClient, userId: string, draft: JobDraft, email: { from: string; subject: string | null },
): Promise<string | null> {
  if (!draft.clientName) return null

  let clientId: string | null = null
  const { data: found } = await supabase.from("clients").select("id")
    .eq("user_id", userId).ilike("name", draft.clientName).limit(1)
  if (found?.length) {
    clientId = found[0].id
  } else {
    const { data: created } = await supabase.from("clients")
      .insert({ user_id: userId, name: draft.clientName })
      .select("id").single()
    clientId = created?.id ?? null
  }
  if (!clientId) return null

  const { data: job } = await supabase.from("jobs").insert({
    user_id: userId,
    client_id: clientId,
    name: draft.jobName ?? draft.clientName,
    description: draft.description,
    hourly_rate: 0, daily_rate: 0,
    currency: draft.currency ?? "BRL",
    status: "proposal",
    contract_value: draft.amount,
    billing_mode: draft.amount ? "fixed" : "daily",
    start_date: draft.startDate, end_date: draft.endDate,
    po_number: draft.poNumber,
    is_recurring: false, tax_rate: 0,
    notes: `Criado automaticamente a partir do e-mail "${email.subject ?? "sem assunto"}" de ${email.from}. Revise os dados.`,
  }).select("id").single()

  return job?.id ?? null
}

/**
 * The nota names its tomador; the client carrying that CNPJ owns it. An open request for
 * one of the client's jobs wins; a client with a single job is unambiguous; anything else
 * is left for the owner to file by hand.
 */
async function jobForTomador(supabase: AdminClient, userId: string, cnpjDigits: string):
  Promise<{ clientName: string | null; jobId: string | null; invoiceId: string | null; jobCount: number }> {
  const { data: clients } = await supabase.from("clients").select("id, name, cnpj").eq("user_id", userId)
  const client = (clients ?? []).find(c => (c.cnpj ?? "").replace(/\D/g, "") === cnpjDigits)
  if (!client) return { clientName: null, jobId: null, invoiceId: null, jobCount: 0 }

  const { data: jobs } = await supabase.from("jobs").select("id")
    .eq("user_id", userId).eq("client_id", client.id).order("created_at", { ascending: false })
  const jobIds = (jobs ?? []).map(j => j.id)
  if (jobIds.length === 0) return { clientName: client.name, jobId: null, invoiceId: null, jobCount: 0 }

  const { data: requests } = await supabase.from("nf_requests").select("job_id, invoice_id")
    .eq("user_id", userId).eq("status", "sent")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true })
    .limit(1)
  const req = requests?.find(r => r.job_id)
  if (req) return { clientName: client.name, jobId: req.job_id, invoiceId: req.invoice_id ?? null, jobCount: jobIds.length }

  if (jobIds.length === 1) return { clientName: client.name, jobId: jobIds[0], invoiceId: null, jobCount: 1 }
  return { clientName: client.name, jobId: null, invoiceId: null, jobCount: jobIds.length }
}

export async function processReceivedEmail(emailId: string): Promise<{ ok: boolean; filed: boolean; error?: string }> {
  const email = await fetchReceivedEmail(emailId)
  if (!email) return { ok: false, filed: false, error: "E-mail não encontrado no Resend" }

  const supabase = createAdminClient()
  const requestId = requestIdFrom([
    ...(email.to ?? []), ...(email.cc ?? []), ...(email.received_for ?? []), ...(email.reply_to ?? []),
  ])

  const { data: nfRequest } = requestId
    ? await supabase.from("nf_requests").select("id, user_id, invoice_id, job_id").eq("id", requestId).maybeSingle()
    : { data: null }

  // Without a request there is no user to file under; the row is kept for whoever owns the
  // inbound domain, which is the only account this mailbox serves.
  const { data: anyUser } = nfRequest ? { data: null } : await supabase.from("user_settings").select("user_id").limit(1).maybeSingle()
  const userId = nfRequest?.user_id ?? anyUser?.user_id
  if (!userId) return { ok: true, filed: false }

  // A reprocessed row keeps its link; without this guard a second pass would spawn a
  // duplicate job from the same PDF.
  const { data: existingRow } = await supabase.from("inbound_emails").select("job_id")
    .eq("resend_email_id", emailId).maybeSingle()
  const alreadyLinkedJobId = existingRow?.job_id ?? null

  const jobId = nfRequest?.job_id
    ?? (nfRequest?.invoice_id
      ? (await supabase.from("invoices").select("job_id").eq("id", nfRequest.invoice_id).maybeSingle()).data?.job_id
      : null)
  let linkedJobId = jobId ?? null

  let filed = false
  let note: string | null = requestId && !nfRequest ? "Pedido não encontrado para este endereço" : null
  const fetched: { id: string; filename: string; content_type: string; size: number; path: string }[] = []

  // Every PDF is kept, not only the one filed as the NF: the first on a job-linked message
  // goes to the job's documents, the rest stay in the owner's inbox folder — Resend's
  // download link dies in an hour, the copy here does not.
  const pdfs = (email.attachments ?? []).filter(isNfAttachment)
  const storedAt = new Map<string, string>()
  let createdJobId: string | null = null
  if (pdfs.length > 0 && !jobId) note = "Anexo recebido, mas o pedido não aponta para um job"

  for (const pdf of pdfs) {
    const bytes = await downloadAttachment(email.id, pdf.id)
    if (!bytes) { note = "Não consegui baixar o anexo do Resend"; continue }
    const name = pdf.filename ?? "nf.pdf"
    const isNf = !filed && !!jobId
    const path = isNf
      ? documentPath(userId, jobId!, "nf", name)
      : inboxAttachmentPath(userId, email.id, `${pdf.id}-${name}`)
    const { error: upload } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: pdf.content_type ?? "application/pdf" })
    if (upload) { note = `Erro ao guardar o anexo: ${upload.message}`; continue }
    storedAt.set(pdf.id, path)
    if (isNf) {
      await supabase.from("job_documents").upsert({
        user_id: userId, job_id: jobId!, kind: "nf",
        path, file_name: name, mime_type: pdf.content_type ?? "application/pdf", size_bytes: bytes.length,
      }, { onConflict: "job_id,kind" })
      filed = true
    } else {
      // Not a job's NF — maybe the company's own paperwork (honorários, DAS, extrato).
      const accounting = await fileAccountingDocument(supabase, userId, name, bytes)
      if (accounting) { note = accounting; continue }

      // Not paperwork either — maybe new work arriving (ordem de serviço, contrato).
      if (!linkedJobId && !createdJobId && !alreadyLinkedJobId) {
        const draft = await jobDraftFromPdf(bytes, name, email.from)
        if (draft?.isWork) {
          const newJobId = await createJobFromDraft(supabase, userId, draft, email)
          if (newJobId) {
            createdJobId = newJobId
            linkedJobId = linkedJobId ?? newJobId
            // The PDF that announced the work becomes the job's contract document.
            const cpath = documentPath(userId, newJobId, "contract", name)
            const { error: cup } = await supabase.storage
              .from(DOCUMENT_BUCKET)
              .upload(cpath, bytes, { upsert: true, contentType: "application/pdf" })
            if (!cup) {
              await supabase.from("job_documents").upsert({
                user_id: userId, job_id: newJobId, kind: "contract",
                path: cpath, file_name: name, mime_type: "application/pdf", size_bytes: bytes.length,
              }, { onConflict: "job_id,kind" })
            }
            note = `Job criado a partir deste e-mail: ${draft.jobName ?? draft.clientName ?? name}`
          }
        }
      }
    }
  }

  if (filed && nfRequest?.invoice_id) {
    await supabase.from("invoices")
      .update({ nf_status: "issued", nf_issued_at: new Date().toISOString() })
      .eq("id", nfRequest.invoice_id)
      .in("nf_status", ["pending", "requested"])
  }

  // The city hall's NFS-e notice carries no attachment, only the nota's link. The PDF is
  // fetched from it, and the tomador named inside the nota decides which job it belongs
  // to — never a blind "oldest request" guess.
  const nfse = nfseLinkFrom(email.text, email.html)
  if (!filed && nfse) {
    const bytes = await downloadNfsePdf(nfse)
    const nota = bytes ? await notaInfoFromPdf(bytes) : null
    if (!bytes || !nota?.valid) {
      note = "Não consegui baixar o PDF da NFS-e no site da prefeitura"
    } else {
      let targetJobId = linkedJobId
      let invoiceId = nfRequest?.invoice_id ?? null
      if (!targetJobId && nota.tomadorCnpj) {
        const match = await jobForTomador(supabase, userId, nota.tomadorCnpj)
        targetJobId = match.jobId
        invoiceId = invoiceId ?? match.invoiceId
        if (!targetJobId) {
          note = match.clientName
            ? `NFS-e ${nfse.numero} de ${nota.tomadorName ?? match.clientName}: o cliente tem ${match.jobCount} jobs — escolha em qual arquivar`
            : `NFS-e ${nfse.numero} de ${nota.tomadorName ?? "tomador desconhecido"}: cliente não cadastrado (CNPJ ${nota.tomadorCnpj})`
        }
      } else if (!targetJobId) {
        note = `NFS-e ${nfse.numero}: não consegui ler o CNPJ do tomador na nota`
      }

      // The per-email copy is the one the attachment points to, so a later nota filed on
      // the same job never overwrites this one.
      const name = `nfse-${nfse.numero}.pdf`
      const path = inboxAttachmentPath(userId, email.id, name)
      const { error: upload } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, bytes, { upsert: true, contentType: "application/pdf" })
      if (upload) {
        note = `Erro ao guardar a NFS-e: ${upload.message}`
      } else {
        fetched.push({ id: `nfse-${nfse.numero}`, filename: name, content_type: "application/pdf", size: bytes.length, path })
        if (targetJobId) {
          await supabase.from("job_documents").upsert({
            user_id: userId, job_id: targetJobId, kind: "nf",
            path, file_name: name, mime_type: "application/pdf", size_bytes: bytes.length,
          }, { onConflict: "job_id,kind" })
          linkedJobId = targetJobId
          filed = true
          note = null
          if (invoiceId) {
            await supabase.from("invoices")
              .update({ nf_status: "issued", nf_issued_at: new Date().toISOString() })
              .eq("id", invoiceId)
              .in("nf_status", ["pending", "requested"])
          }
        }
      }
    }
  }

  await supabase.from("inbound_emails").upsert({
    user_id: userId,
    nf_request_id: nfRequest?.id ?? null,
    invoice_id: nfRequest?.invoice_id ?? null,
    job_id: linkedJobId,
    resend_email_id: email.id,
    from_email: email.from,
    to_email: (email.to ?? [])[0] ?? null,
    subject: email.subject,
    body: bodyOf(email),
    attachments: [
      ...(email.attachments ?? []).map(a => ({
        ...a, path: storedAt.get(a.id) ?? null,
      })),
      ...fetched,
    ] as unknown as Record<string, unknown>[],
    filed, note,
  }, { onConflict: "resend_email_id" })

  return { ok: true, filed }
}

/**
 * The webhook is the fast path, but a missed delivery would lose an e-mail for good — so
 * the poll lists what Resend received and processes whatever the inbox does not have yet.
 */
export async function pollNewEmails(limit = 50): Promise<{ listed: number; imported: number; errors: string[] }> {
  const res = await fetch(`${RESEND_API}/emails/receiving?limit=${limit}`, { headers: auth() })
  if (!res.ok) {
    const detail = await res.json().then((d: { message?: string }) => d.message).catch(() => null)
    return { listed: 0, imported: 0, errors: [`Resend respondeu ${res.status}${detail ? ` (${detail})` : ""}`] }
  }

  const body = await res.json() as { data?: { id: string }[] }
  const ids = (body.data ?? []).map(e => e.id)
  if (ids.length === 0) return { listed: 0, imported: 0, errors: [] }

  const supabase = createAdminClient()
  const { data: known } = await supabase
    .from("inbound_emails")
    .select("resend_email_id, body, attachments")
    .in("resend_email_id", ids)
  // A row kept with neither body nor attachments was fetched before Resend finished
  // processing the message; it deserves a second pass rather than a lifetime of empty.
  const complete = new Set((known ?? [])
    .filter(k => (k.body && k.body.trim()) || (Array.isArray(k.attachments) && k.attachments.length > 0))
    .map(k => k.resend_email_id))

  let imported = 0
  const errors: string[] = []
  for (const id of ids) {
    if (complete.has(id)) continue
    const result = await processReceivedEmail(id)
    if (result.ok) imported++
    else errors.push(`${id}: ${result.error}`)
  }
  return { listed: ids.length, imported, errors }
}
