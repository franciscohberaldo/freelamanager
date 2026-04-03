import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { LogsClient } from "./logs-client"

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { month?: string; job_id?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthParam = searchParams.month ?? format(now, "yyyy-MM")
  const [year, month] = monthParam.split("-").map(Number)
  const monthStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const monthEnd   = format(new Date(year, month, 0),    "yyyy-MM-dd")

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, hourly_rate, daily_rate, currency, clients(name)")
    .eq("user_id", user!.id)
    .in("status", ["active", "paused"])
    .order("name")

  let query = supabase
    .from("daily_logs")
    .select("*, jobs(name, hourly_rate, currency, clients(name))")
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })

  if (searchParams.job_id) {
    query = query.eq("job_id", searchParams.job_id)
  }

  const { data: logs } = await query

  return (
    <LogsClient
      logs={(logs ?? []) as any}
      jobs={(jobs ?? []) as any}
      currentMonth={monthParam}
    />
  )
}
