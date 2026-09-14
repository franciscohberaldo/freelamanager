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

  const { data: settings } = await supabase
    .from("user_settings")
    .select("hour_rounding")
    .eq("user_id", user!.id)
    .single()

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, hourly_rate, daily_rate, billing_mode, currency, clients(name)")
    .eq("user_id", user!.id)
    .in("status", ["active", "paused"])
    .order("name")

  let query = supabase
    .from("daily_logs")
    .select("*, jobs(name, hourly_rate, currency, clients(name))", { count: "exact" })
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })

  if (searchParams.job_id) {
    query = query.eq("job_id", searchParams.job_id)
  }

  const { data: logs, count: logsCount } = await query.range(0, 24)

  return (
    <LogsClient
      logs={(logs ?? []) as unknown as (import("@/lib/supabase/types").DailyLog & { jobs: { name: string; hourly_rate: number; currency: string; clients: { name: string } | null } | null })[]}
      logsCount={logsCount ?? 0}
      jobs={(jobs ?? []) as unknown as { id: string; name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"; currency: string; clients: { name: string } | null }[]}
      currentMonth={monthParam}
      hourRounding={settings?.hour_rounding ?? "none"}
    />
  )
}
