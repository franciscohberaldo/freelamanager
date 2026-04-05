import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { FolgasClient } from "./folgas-client"

export default async function FolgasPage({
  searchParams,
}: {
  searchParams: { month?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now        = new Date()
  const monthParam = searchParams.month ?? format(now, "yyyy-MM")
  const [year, month] = monthParam.split("-").map(Number)
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const monthEnd   = format(new Date(year, month, 0), "yyyy-MM-dd")

  const { data: timeOff } = await supabase
    .from("time_off")
    .select("*")
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date")

  // Also fetch 3-month window for context
  const windowStart = `${year}-01-01`
  const windowEnd   = `${year}-12-31`
  const { data: yearTimeOff } = await supabase
    .from("time_off")
    .select("date, type")
    .eq("user_id", user!.id)
    .gte("date", windowStart)
    .lte("date", windowEnd)

  return (
    <FolgasClient
      timeOff={timeOff ?? []}
      yearTimeOff={yearTimeOff ?? []}
      currentMonth={monthParam}
    />
  )
}
