import { createClient } from "@/lib/supabase/server"
import { DOCUMENT_BUCKET } from "@/lib/job-documents"
import { EmailsClient, type InboundEmail, type EmailAttachment } from "./emails-client"

/** The links expire in an hour; opening the page again mints fresh ones. */
const SIGNED_URL_TTL_SECONDS = 3600

export default async function EmailsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from("inbound_emails")
    .select("*, jobs(name), invoices(seq_number, invoice_number)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const emails = (rows ?? []) as unknown as InboundEmail[]

  // An attachment's bytes live in the documents bucket; what reaches the browser is a
  // signed URL, not the storage path.
  const paths = emails.flatMap(e =>
    (e.attachments ?? [])
      .map(a => (a as EmailAttachment & { path?: string | null }).path)
      .filter((p): p is string => !!p)
  )
  const signed = new Map<string, string>()
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  for (const e of emails) {
    e.attachments = (e.attachments ?? []).map(a => {
      const { path, ...rest } = a as EmailAttachment & { path?: string | null }
      return { ...rest, url: path ? signed.get(path) ?? null : null }
    })
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-light tracking-tight">Caixa de entrada</h1>
        <p className="text-muted-foreground text-sm">
          {emails.length} e-mails recebidos em nf@nf.chico.cx
        </p>
      </div>

      <EmailsClient emails={emails} />
    </div>
  )
}
