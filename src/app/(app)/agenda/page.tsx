import { createClient } from "@/lib/supabase/server"
import { AgendaClient } from "./agenda-client"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const year = new Date().getFullYear()

  const [
    { data: events, error: eventsError },
    { data: jobs },
    { data: holds },
    { data: logs },
  ] = await Promise.all([
    supabase
      .from("agenda_events")
      .select("*, jobs(name)")
      .eq("user_id", user!.id)
      .order("event_date"),
    supabase
      .from("jobs")
      .select("id, name, start_date, end_date, status, hourly_rate, daily_rate, billing_mode, currency, clients(name)")
      .eq("user_id", user!.id)
      .neq("status", "completed")
      .order("name"),
    supabase
      .from("availability_holds")
      .select("id, type, start_date, end_date, note, clients(name), jobs(name)")
      .eq("user_id", user!.id)
      .lte("start_date", `${year + 1}-12-31`)
      .gte("end_date", `${year - 1}-01-01`),
    supabase
      .from("daily_logs")
      .select("id, job_id, date, hours_worked, hours_billed, total_value, jobs(name)")
      .eq("user_id", user!.id)
      .gte("date", `${year - 1}-01-01`)
      .lte("date", `${year + 1}-12-31`)
      .order("date"),
  ])

  if (eventsError) {
    console.error("agenda_events query error:", eventsError.message)
  }

  return (
    <AgendaClient
      events={events ?? []}
      jobs={(jobs ?? []) as unknown as import("./agenda-client").AgendaJob[]}
      holds={(holds ?? []) as unknown as import("./calendar-view").CalendarHold[]}
      logs={(logs ?? []) as unknown as import("./day-dialog").DayLog[]}
    />
  )
}
