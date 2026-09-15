import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"
import { replyAddress } from "@/lib/inbound-email"

/**
 * An answer written in the inbox. It goes out from the same sender the NF requests use,
 * and — when the original message is tied to a request — carries that request's
 * plus-address as replyTo, so the accountant's next answer still lands on the same thread.
 * The sent copy is filed as an `out` row, making the conversation readable end to end.
 */
export async function POST(request: NextRequest) {
  const { id, body } = await request.json().catch(() => ({})) as { id?: string; body?: string }
  if (!id || !body?.trim()) {
    return NextResponse.json({ error: "Informe o e-mail e o texto da resposta" }, { status: 400 })
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

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sent, error } = await resend.emails.send({
    from,
    to: [original.from_email],
    replyTo: replyTo ?? undefined,
    subject,
    text: body.trim(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  const { error: save } = await supabase.from("inbound_emails").insert({
    user_id: user.id,
    nf_request_id: original.nf_request_id,
    invoice_id: original.invoice_id,
    job_id: original.job_id,
    resend_email_id: sent?.id ?? crypto.randomUUID(),
    from_email: from,
    to_email: original.from_email,
    subject,
    body: body.trim(),
    direction: "out",
    in_reply_to: original.id,
  })
  if (save) return NextResponse.json({ ok: true, sent: true, warning: "Enviado, mas não consegui registrar a cópia" })

  return NextResponse.json({ ok: true })
}
