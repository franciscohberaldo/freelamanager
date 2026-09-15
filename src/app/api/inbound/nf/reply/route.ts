import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { replyAddress, inboxAttachmentPath } from "@/lib/inbound-email"
import { DOCUMENT_BUCKET } from "@/lib/job-documents"

/** Resend tops out near 40 MB per message; staying well under keeps room for the text. */
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

/**
 * An answer written in the inbox, now carrying files too. It goes out from the same sender
 * the NF requests use, and — when the original message is tied to a request — carries that
 * request's plus-address as replyTo, so the accountant's next answer still lands on the
 * same thread. The sent copy is filed as an `out` row, attachments as metadata only (the
 * bytes travel with the e-mail; what stays here is the record of what was sent).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })

  const id = String(form.get("id") ?? "")
  const body = String(form.get("body") ?? "").trim()
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)

  if (!id || (!body && files.length === 0)) {
    return NextResponse.json({ error: "Informe o e-mail e o texto da resposta" }, { status: 400 })
  }
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "Anexos passam de 25 MB no total" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: original } = await supabase
    .from("inbound_emails")
    .select("id, nf_request_id, invoice_id, job_id, from_email, subject")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!original) return NextResponse.json({ error: "E-mail não encontrado" }, { status: 404 })

  const domain = process.env.RESEND_INBOUND_DOMAIN
  const replyTo = original.nf_request_id
    ? replyAddress(original.nf_request_id, domain)
    : domain ? `nf@${domain}` : undefined

  const baseSubject = original.subject ?? ""
  const subject = /^re:/i.test(baseSubject.trim()) ? baseSubject : `Re: ${baseSubject}`
  const from = process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com"

  const attachments = await Promise.all(files.map(async f => ({
    filename: f.name,
    content: Buffer.from(await f.arrayBuffer()),
  })))

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sent, error } = await resend.emails.send({
    from,
    to: [original.from_email],
    replyTo: replyTo ?? undefined,
    subject,
    text: body || "(anexo)",
    attachments: attachments.length ? attachments : undefined,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  // The bytes travel with the e-mail and are kept here too, so a sent file can be opened
  // again from the thread. The bucket only takes PDF/PNG/JPG up to 10 MB; anything else is
  // recorded as metadata, like before.
  const emailId = sent?.id ?? crypto.randomUUID()
  const stored = await Promise.all(files.map(async (f, i) => {
    const path = inboxAttachmentPath(user.id, emailId, `${i}-${f.name}`)
    const { error: upload } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, attachments[i].content, { contentType: f.type || "application/octet-stream" })
    return {
      id: crypto.randomUUID(),
      filename: f.name,
      content_type: f.type || null,
      size: f.size,
      path: upload ? null : path,
    }
  }))

  const { error: save } = await supabase.from("inbound_emails").insert({
    user_id: user.id,
    nf_request_id: original.nf_request_id,
    invoice_id: original.invoice_id,
    job_id: original.job_id,
    resend_email_id: emailId,
    from_email: from,
    to_email: original.from_email,
    subject,
    body,
    attachments: stored,
    direction: "out",
    in_reply_to: original.id,
  })
  if (save) return NextResponse.json({ ok: true, sent: true, warning: "Enviado, mas não consegui registrar a cópia" })

  return NextResponse.json({ ok: true })
}
