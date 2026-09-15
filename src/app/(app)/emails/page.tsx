import { createClient } from "@/lib/supabase/server"
import { EmailsClient, type InboundEmail } from "./emails-client"

export default async function EmailsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: emails } = await supabase
    .from("inbound_emails")
    .select("*, jobs(name), invoices(seq_number, invoice_number)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-light tracking-tight">Caixa de entrada</h1>
        <p className="text-muted-foreground text-sm">
          {emails?.length ?? 0} e-mails recebidos em nf@nf.chico.cx
        </p>
      </div>

      <EmailsClient emails={(emails ?? []) as unknown as InboundEmail[]} />
    </div>
  )
}
