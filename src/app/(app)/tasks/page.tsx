import { createClient } from "@/lib/supabase/server"
import { TasksClient, type PendingReceipt } from "./tasks-client"
import type { AgendaJob } from "../agenda/agenda-client"
import type { AgendaEvent } from "@/lib/supabase/types"

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: events },
    { data: jobs },
    { data: receipts },
  ] = await Promise.all([
    supabase
      .from("agenda_events")
      .select("*, jobs(name)")
      .eq("user_id", user!.id)
      .eq("is_done", false)
      .neq("task_status", "done")
      .order("event_date"),
    supabase
      .from("jobs")
      .select("id, name, start_date, end_date, status")
      .eq("user_id", user!.id)
      .neq("status", "completed")
      .order("name"),
    supabase
      .from("invoices")
      .select("id, invoice_number, seq_number, status, total, currency, due_date, jobs(name, clients(name))")
      .eq("user_id", user!.id)
      .in("status", ["sent", "overdue"])
      .order("due_date"),
  ])

  return (
    <TasksClient
      events={(events ?? []) as unknown as (AgendaEvent & { jobs: { name: string } | null })[]}
      jobs={(jobs ?? []) as unknown as AgendaJob[]}
      receipts={(receipts ?? []) as unknown as PendingReceipt[]}
    />
  )
}
