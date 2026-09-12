import { createClient } from "@/lib/supabase/server"
import { NfClient, type NfRow } from "./nf-client"

export default async function NotasFiscaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from("invoices")
    .select("*, jobs(name, clients(name, legal_name))")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
  return <NfClient rows={(data ?? []) as unknown as NfRow[]} />
}
