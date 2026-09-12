import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { AgendaClient } from "./agenda-client"

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthParam = searchParams.month ?? format(now, "yyyy-MM")
  const [year, month] = monthParam.split("-").map(Number)
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const monthEnd = format(new Date(year, month, 0), "yyyy-MM-dd")
  const windowStart = `${year}-01-01`
  const windowEnd = `${year}-12-31`

  const [
    { data: events, error: eventsError },
    { data: jobs },
    { data: availability },
    { data: timeOff },
    { data: yearTimeOff },
    { data: holds },
  ] = await Promise.all([
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
    supabase
      .from("user_availability")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("time_off")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date"),
    supabase
      .from("time_off")
      .select("date, type")
      .eq("user_id", user!.id)
      .gte("date", windowStart)
      .lte("date", windowEnd),
    supabase
      .from("availability_holds")
      .select("id, type, start_date, end_date, note, clients(name), jobs(name)")
      .eq("user_id", user!.id)
      .lte("start_date", `${year + 1}-12-31`)
      .gte("end_date", `${year - 1}-01-01`),
  ])

  if (eventsError) {
    console.error("agenda_events query error:", eventsError.message)
  }

  return (
    <AgendaClient
      events={events ?? []}
      jobs={jobs ?? []}
      availability={availability}
      timeOff={timeOff ?? []}
      yearTimeOff={yearTimeOff ?? []}
      holds={(holds ?? []) as unknown as import("./calendar-view").CalendarHold[]}
      currentMonth={monthParam}
    />
  )
}
