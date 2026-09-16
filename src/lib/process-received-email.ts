/**
 * The whole life of a received e-mail, shared by the webhook and the hourly poll: fetch it
 * from Resend, match it to the NF request it answers, file its PDF as the job's NF, and
 * record it in the owner's inbox.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { requestIdFrom, isNfAttachment, inboxAttachmentPath } from "@/lib/inbound-email"
import { DOCUMENT_BUCKET, documentPath } from "@/lib/job-documents"

const RESEND_API = "https://api.resend.com"

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

  const jobId = nfRequest?.job_id
    ?? (nfRequest?.invoice_id
      ? (await supabase.from("invoices").select("job_id").eq("id", nfRequest.invoice_id).maybeSingle()).data?.job_id
      : null)

  let filed = false
  let note: string | null = requestId && !nfRequest ? "Pedido não encontrado para este endereço" : null

  // Every PDF is kept, not only the one filed as the NF: the first on a job-linked message
  // goes to the job's documents, the rest stay in the owner's inbox folder — Resend's
  // download link dies in an hour, the copy here does not.
  const pdfs = (email.attachments ?? []).filter(isNfAttachment)
  const storedAt = new Map<string, string>()
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
    }
  }

  if (filed && nfRequest?.invoice_id) {
    await supabase.from("invoices")
      .update({ nf_status: "issued", nf_issued_at: new Date().toISOString() })
      .eq("id", nfRequest.invoice_id)
      .in("nf_status", ["pending", "requested"])
  }

  await supabase.from("inbound_emails").upsert({
    user_id: userId,
    nf_request_id: nfRequest?.id ?? null,
    invoice_id: nfRequest?.invoice_id ?? null,
    job_id: jobId ?? null,
    resend_email_id: email.id,
    from_email: email.from,
    to_email: (email.to ?? [])[0] ?? null,
    subject: email.subject,
    body: bodyOf(email),
    attachments: (email.attachments ?? []).map(a => ({
      ...a, path: storedAt.get(a.id) ?? null,
    })) as unknown as Record<string, unknown>[],
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
  if (!res.ok) return { listed: 0, imported: 0, errors: [`Resend respondeu ${res.status}`] }

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
