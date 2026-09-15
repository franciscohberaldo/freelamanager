import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { DOCUMENT_BUCKET, documentPath } from "@/lib/job-documents"

type StoredAttachment = {
  id?: string | null
  filename?: string | null
  content_type?: string | null
  path?: string | null
}

/**
 * The manual fix for an automatic match that never happened: the accountant's PDF arrived
 * without a request to point it at, so the owner picks the job it belongs to. The bytes
 * already sit in the owner's inbox folder, so filing is a copy inside the same bucket —
 * the e-mail keeps its copy, the job gets its NF.
 */
export async function POST(request: NextRequest) {
  const { emailId, attachmentId, jobId } = await request.json().catch(() => ({})) as {
    emailId?: string; attachmentId?: string; jobId?: string
  }
  if (!emailId || !attachmentId || !jobId) {
    return NextResponse.json({ error: "Informe o e-mail, o anexo e o job" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const [{ data: email }, { data: job }] = await Promise.all([
    supabase.from("inbound_emails").select("id, attachments").eq("id", emailId).eq("user_id", user.id).maybeSingle(),
    supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", user.id).maybeSingle(),
  ])
  if (!email) return NextResponse.json({ error: "E-mail não encontrado" }, { status: 404 })
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })

  const attachment = ((email.attachments ?? []) as StoredAttachment[])
    .find(a => a.id === attachmentId)
  if (!attachment) return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 })
  if (!attachment.path) {
    return NextResponse.json({ error: "Os bytes deste anexo não estão guardados (chegou antes desta funcionalidade)" }, { status: 400 })
  }

  const name = attachment.filename ?? "nf.pdf"
  const nfPath = documentPath(user.id, jobId, "nf", name)

  const { error: copy } = await supabase.storage.from(DOCUMENT_BUCKET).copy(attachment.path, nfPath)
  if (copy) {
    // Older rows or cross-folder quirks: fall back to carrying the bytes over by hand.
    const { data: bytes, error: down } = await supabase.storage.from(DOCUMENT_BUCKET).download(attachment.path)
    if (down) return NextResponse.json({ error: `Não consegui ler o anexo: ${down.message}` }, { status: 502 })
    const { error: up } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(nfPath, bytes, { upsert: true, contentType: attachment.content_type ?? "application/pdf" })
    if (up) return NextResponse.json({ error: `Erro ao guardar a NF: ${up.message}` }, { status: 502 })
  }

  const { error: doc } = await supabase.from("job_documents").upsert({
    user_id: user.id, job_id: jobId, kind: "nf",
    path: nfPath, file_name: name,
    mime_type: attachment.content_type ?? "application/pdf", size_bytes: null,
  }, { onConflict: "job_id,kind" })
  if (doc) return NextResponse.json({ error: doc.message }, { status: 502 })

  await supabase.from("inbound_emails")
    .update({ job_id: jobId, filed: true, note: null })
    .eq("id", emailId)

  return NextResponse.json({ ok: true })
}
