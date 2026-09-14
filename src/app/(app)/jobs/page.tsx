import { createClient } from "@/lib/supabase/server"
import { JobsClient } from "./jobs-client"
import type { HistoryJob } from "./job-history"

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: jobs, count: jobsCount }, { data: clients }, { data: history }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, clients(name)", { count: "exact" })
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .range(0, 24),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("jobs")
      .select("*, clients(name, legal_name), invoices(seq_number, invoice_number, nf_number, total, currency, status, nf_status, period_start, period_end, nf_issued_at)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ])

  return (
    <JobsClient
      jobs={(jobs ?? []) as never[]}
      jobsCount={jobsCount ?? 0}
      clients={clients ?? []}
      history={(history ?? []) as unknown as HistoryJob[]}
    />
  )
}
