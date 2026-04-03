import { createClient } from "@/lib/supabase/server"
import { AgendaClient } from "./agenda-client"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: events, error: eventsError }, { data: jobs }] = await Promise.all([
    supabase
      .from("agenda_events")
      .select("*, jobs(name)")
      .eq("user_id", user!.id)
      .order("event_date"),
    supabase
      .from("jobs")
      .select("id, name, start_date, end_date, status")
      .eq("user_id", user!.id)
      .order("name"),
  ])

  // If query fails (e.g. migration not run yet), show empty state
  if (eventsError) {
    console.error("agenda_events query error:", eventsError.message)
  }

  return <AgendaClient events={(events ?? []) as any} jobs={jobs ?? []} />
}
