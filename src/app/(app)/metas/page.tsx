import { createClient } from "@/lib/supabase/server"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { MetasClient } from "./metas-client"

export default async function MetasPage({
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
  const monthEnd   = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd")

  const [
    { data: goals },
    { data: logs },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user!.id)
      .eq("period", monthParam),
    supabase
      .from("daily_logs")
      .select("hours_worked, total_value")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
  ])

  const actualHours   = logs?.reduce((s, l) => s + l.hours_worked, 0) ?? 0
  const actualRevenue = logs?.reduce((s, l) => s + l.total_value,  0) ?? 0
  const totalExpenses = expenses?.reduce((s, e) => s + e.amount,   0) ?? 0

  return (
    <MetasClient
      goals={goals ?? []}
      currentMonth={monthParam}
      actualHours={actualHours}
      actualRevenue={actualRevenue}
      totalExpenses={totalExpenses}
    />
  )
}
