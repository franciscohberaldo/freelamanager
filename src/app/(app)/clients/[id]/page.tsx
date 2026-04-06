import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ClientDetailClient } from "./client-detail-client"

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: client }, { data: interactions }, { data: jobs }, { data: invoices }, { data: portal }] = await Promise.all([
    supabase
      .from("clients")
      .select("*, client_contacts(*)")
      .eq("id", params.id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("client_interactions")
      .select("*")
      .eq("client_id", params.id)
      .eq("user_id", user!.id)
      .order("happened_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, name, status, hourly_rate, currency, start_date, end_date")
      .eq("client_id", params.id)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, currency, status, period_start, period_end")
      .eq("user_id", user!.id)
      .in("job_id", (await supabase.from("jobs").select("id").eq("client_id", params.id).eq("user_id", user!.id)).data?.map(j => j.id) ?? [])
      .order("created_at", { ascending: false }),
    supabase
      .from("client_portal_tokens")
      .select("token")
      .eq("client_id", params.id)
      .single(),
  ])

  if (!client) notFound()

  return (
    <ClientDetailClient
      client={client as any}
      interactions={interactions ?? []}
      jobs={jobs ?? []}
      invoices={invoices ?? []}
      portalToken={portal?.token ?? null}
    />
  )
}
