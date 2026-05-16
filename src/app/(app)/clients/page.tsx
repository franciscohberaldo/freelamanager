import { createClient } from "@/lib/supabase/server"
import { ClientsPageClient } from "./clients-page-client"

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: clients, count: clientsCount }, { data: deals }, { data: pipelineClients }] = await Promise.all([
    supabase
      .from("clients")
      .select("*, client_contacts(*)", { count: "exact" })
      .eq("user_id", user!.id)
      .order("name")
      .range(0, 24),
    supabase
      .from("sales_pipeline")
      .select("*, clients(id, name, company)")
      .eq("user_id", user!.id)
      .order("position"),
    supabase
      .from("clients")
      .select("id, name, company")
      .eq("user_id", user!.id)
      .order("name"),
  ])

  return (
    <ClientsPageClient
      clients={clients ?? []}
      clientsCount={clientsCount ?? 0}
      deals={deals ?? []}
      pipelineClients={pipelineClients ?? []}
    />
  )
}
