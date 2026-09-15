import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requestIdFrom, isNfAttachment, verifySignature, inboxAttachmentPath } from "@/lib/inbound-email"
import { DOCUMENT_BUCKET, documentPath } from "@/lib/job-documents"

const RESEND_API = "https://api.resend.com"

type ReceivedEmail = {
  id: string
  from: string
  to: string[] | null
  cc: string[] | null
  reply_to: string[] | null
  received_for: string[] | null
  subject: string | null
  text: string | null
  attachments: { id: string; filename: string | null; content_type: string | null; size: number | null }[] | null
}

const auth = { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }

async function fetchEmail(emailId: string): Promise<ReceivedEmail | null> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}`, { headers: auth })
  return res.ok ? (await res.json()) as ReceivedEmail : null
}

/**
 * The webhook carries only the attachment's metadata, so its bytes are asked for separately
 * and fetched from a link that lives for an hour.
 */
async function downloadAttachment(emailId: string, attachmentId: string): Promise<Buffer | null> {
  const res = await fetch(`${RESEND_API}/emails/receiving/${emailId}/attachments/${attachmentId}`, { headers: auth })
  if (!res.ok) return null
  const { download_url } = await res.json() as { download_url?: string }
  if (!download_url) return null
  const file = await fetch(download_url)
  return file.ok ? Buffer.from(await file.arrayBuffer()) : null
}

/**
 * What the accountant sends back. A reply is matched to its request by the address it came
 * to, the PDF is filed as the job's NF, and the invoice's NF is marked issued. An e-mail
 * that matches nothing is still recorded — better an unread row than a lost note.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 })
  const signed = verifySignature({
    secret, body: raw,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    header: request.headers.get("svix-signature"),
  })
  if (!signed) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })

  const event = JSON.parse(raw) as { type?: string; data?: { email_id?: string } }
  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: event.type })

  const emailId = event.data?.email_id
  if (!emailId) return NextResponse.json({ error: "email_id ausente" }, { status: 400 })

  const email = await fetchEmail(emailId)
  if (!email) return NextResponse.json({ error: "E-mail não encontrado no Resend" }, { status: 502 })

  const supabase = createAdminClient()
  const requestId = requestIdFrom([
    ...(email.to ?? []), ...(email.cc ?? []), ...(email.received_for ?? []), ...(email.reply_to ?? []),
  ])

  const { data: nfRequest } = requestId
    ? await supabase.from("nf_requests").select("id, user_id, invoice_id, job_id").eq("id", requestId).maybeSingle()
    : { data: null }

  // Without a request there is no user to file under; the row is kept for whoever owns the
  // inbound domain, which is the only account this webhook serves.
  const { data: anyUser } = nfRequest ? { data: null } : await supabase.from("user_settings").select("user_id").limit(1).maybeSingle()
  const userId = nfRequest?.user_id ?? anyUser?.user_id
  if (!userId) return NextResponse.json({ ok: true, ignored: "sem usuário" })

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
    body: email.text,
    attachments: (email.attachments ?? []).map(a => ({
      ...a, path: storedAt.get(a.id) ?? null,
    })) as unknown as Record<string, unknown>[],
    filed, note,
  }, { onConflict: "resend_email_id" })

  return NextResponse.json({ ok: true, filed })
}
