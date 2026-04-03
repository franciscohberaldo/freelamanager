import { createClient } from "@/lib/supabase/server"
import { AgendaClient } from "./agenda-client"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: events }, { data: jobs }] = await Promise.all([
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda & Gantt</h1>
        <p className="text-muted-foreground text-sm">Pagamentos, entregas, milestones e prazos</p>
      </div>
      <AgendaClient events={events ?? []} jobs={jobs ?? []} />
    </div>
  )
}
