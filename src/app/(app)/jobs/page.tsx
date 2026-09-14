import { createClient } from "@/lib/supabase/server"
import { JobsClient } from "./jobs-client"

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: jobs, count: jobsCount }, { data: clients }] = await Promise.all([
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
  ])

  return (
    <JobsClient
      jobs={(jobs ?? []) as never[]}
      jobsCount={jobsCount ?? 0}
      clients={clients ?? []}
    />
  )
}
