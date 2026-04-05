import { createClient } from "@/lib/supabase/server"
import { format } from "date-fns"
import { JournalClient } from "./journal-client"

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
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
  const monthEnd   = format(new Date(year, month, 0), "yyyy-MM-dd")

  const { data: entries } = await supabase
    .from("daily_journal")
    .select("*")
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })

  return <JournalClient entries={entries ?? []} currentMonth={monthParam} />
}
