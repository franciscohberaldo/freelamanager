import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { DespesasClient } from "./despesas-client"

export default async function DespesasPage({
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

  // Load expenses for the month
  const { data: expenses, count: expensesCount } = await supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })
    .range(0, 24)

  // Also load totals per category for the whole year (for the chart)
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`
  const { data: yearExpenses } = await supabase
    .from("expenses")
    .select("date, amount, category")
    .eq("user_id", user!.id)
    .gte("date", yearStart)
    .lte("date", yearEnd)

  return (
    <DespesasClient
      expenses={expenses ?? []}
      expensesCount={expensesCount ?? 0}
      yearExpenses={yearExpenses ?? []}
      currentMonth={monthParam}
    />
  )
}
