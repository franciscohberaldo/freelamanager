import { createClient } from "@/lib/supabase/server"
import { startOfMonth, endOfMonth, format, subMonths, subDays } from "date-fns"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const today       = format(now, "yyyy-MM-dd")
  const monthParam  = format(now, "yyyy-MM")
  const monthStart  = format(startOfMonth(now), "yyyy-MM-dd")
  const monthEnd    = format(endOfMonth(now), "yyyy-MM-dd")
  const forecastStart = format(subMonths(now, 8), "yyyy-MM-dd")
  const fourteenDaysAgo = format(subDays(now, 14), "yyyy-MM-dd")

  const [
    { data: monthLogs },
    { data: activeJobs },
    { data: recentInvoices },
    { data: upcomingEvents },
    { data: allMonthlyData },
    { data: monthExpenses },
    { data: goals },
    { data: forecastLogs },
    { data: todayLogs },
    { data: todayEvents },
    { data: overdueInvoices },
    { data: recentDailyLogs },
  ] = await Promise.all([
    // Monthly queries (existing)
    supabase
      .from("daily_logs")
      .select("hours_worked, hours_billed, total_value")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("jobs")
      .select("id, name, hourly_rate, currency, clients(name)")
      .eq("user_id", user!.id)
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, currency, status, period_start, period_end, jobs(name)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("agenda_events")
      .select("id, title, type, event_date, is_done, jobs(name)")
      .eq("user_id", user!.id)
      .eq("is_done", false)
      .gte("event_date", today)
      .order("event_date")
      .limit(5),
    supabase
      .from("daily_logs")
      .select("date, total_value, hours_billed")
      .eq("user_id", user!.id)
      .order("date"),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user!.id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user!.id)
      .eq("period", monthParam),
    supabase
      .from("daily_logs")
      .select("date, total_value")
      .eq("user_id", user!.id)
      .gte("date", forecastStart)
      .order("date"),
    // Daily queries (new)
    supabase
      .from("daily_logs")
      .select("id, hours_worked, hours_billed, total_value, notes, jobs(id, name, clients(name))")
      .eq("user_id", user!.id)
      .eq("date", today),
    supabase
      .from("agenda_events")
      .select("id, title, type, event_date, is_done, jobs(name)")
      .eq("user_id", user!.id)
      .eq("event_date", today)
      .order("is_done")
      .order("type"),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, currency, status, due_date, jobs(name, clients(name))")
      .eq("user_id", user!.id)
      .in("status", ["overdue"])
      .order("due_date"),
    supabase
      .from("daily_logs")
      .select("date, jobs(id, name)")
      .eq("user_id", user!.id)
      .gte("date", fourteenDaysAgo)
      .order("date", { ascending: false }),
  ])

  return (
    <DashboardClient
      monthly={{
        now: now.toISOString(),
        monthLogs: monthLogs ?? [],
        activeJobs: (activeJobs ?? []) as unknown as { id: string; name: string; hourly_rate: number; currency: string; clients: unknown }[],
        recentInvoices: (recentInvoices ?? []) as unknown as { id: string; invoice_number: string; total: number; currency: string; status: string; period_start: string; period_end: string; jobs: unknown }[],
        upcomingEvents: (upcomingEvents ?? []) as unknown as { id: string; title: string; type: string; event_date: string; is_done: boolean; jobs: unknown }[],
        allMonthlyData: (allMonthlyData ?? []) as unknown as { date: string; total_value: number; hours_billed: number }[],
        monthExpenses: monthExpenses ?? [],
        goals: (goals ?? []) as unknown as { id: string; type: string; target: number; period: string }[],
        forecastLogs: (forecastLogs ?? []) as unknown as { date: string; total_value: number }[],
      }}
    />
  )
}
