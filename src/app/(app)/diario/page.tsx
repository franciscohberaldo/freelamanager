import { createClient } from "@/lib/supabase/server"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { TrackingClient } from "./tracking-client"

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now        = new Date()
  const monthParam = searchParams.month ?? format(now, "yyyy-MM")
  const [year, month] = monthParam.split("-").map(Number)
  const monthStart = format(startOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd")
  const monthEnd   = format(endOfMonth(new Date(year, month - 1, 1)),   "yyyy-MM-dd")

  const [{ data: logs }, { data: jobs }] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("id, date, hours_worked, hours_billed, total_value, job_id, jobs(id, name, clients(name))")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date"),
    supabase
      .from("jobs")
      .select("id, name, hourly_rate, currency, clients(name)")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("name"),
  ])

  return (
    <TrackingClient
      logs={(logs ?? []) as any}
      jobs={(jobs ?? []) as any}
      currentMonth={monthParam}
    />
  )
}
