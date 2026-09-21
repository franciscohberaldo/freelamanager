import { createClient } from "@/lib/supabase/server"
import { AgendaClient } from "./agenda-client"
import { jobStage, type StageInvoice, type StageDocument } from "@/lib/job-stage"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const year = new Date().getFullYear()

  const [
    { data: events, error: eventsError },
    { data: jobs },
    { data: holds },
    { data: logs },
    { data: invoices },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("agenda_events")
      .select("*, jobs(name)")
      .eq("user_id", user!.id)
      .order("event_date"),
    supabase
      .from("jobs")
      .select("id, name, start_date, end_date, status, hourly_rate, daily_rate, billing_mode, currency, clients(name)")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("availability_holds")
      .select("id, type, start_date, end_date, note, clients(name), jobs(name)")
      .eq("user_id", user!.id)
      .lte("start_date", `${year + 1}-12-31`)
      .gte("end_date", `${year - 1}-01-01`),
    supabase
      .from("daily_logs")
      .select("id, job_id, date, daily_rate, hours_worked, hours_billed, total_value, jobs(name)")
      .eq("user_id", user!.id)
      .gte("date", `${year - 1}-01-01`)
      .lte("date", `${year + 1}-12-31`)
      .order("date"),
    supabase
      .from("invoices")
      .select("job_id, status, nf_status")
      .eq("user_id", user!.id),
    supabase
      .from("job_documents")
      .select("job_id, kind")
      .eq("user_id", user!.id),
  ])

  // Where each job stands — work, invoice, NF, DAS, money — drawn on its calendar chip.
  const invoicesByJob = new Map<string, StageInvoice[]>()
  for (const i of invoices ?? []) invoicesByJob.set(i.job_id, [...(invoicesByJob.get(i.job_id) ?? []), i])
  const docsByJob = new Map<string, StageDocument[]>()
  for (const d of documents ?? []) docsByJob.set(d.job_id, [...(docsByJob.get(d.job_id) ?? []), d])
  const jobsWithStage = (jobs ?? []).map(j => ({
    ...j,
    stage: jobStage(j, invoicesByJob.get(j.id) ?? [], docsByJob.get(j.id) ?? []),
  }))

  if (eventsError) {
    console.error("agenda_events query error:", eventsError.message)
  }

  return (
    <AgendaClient
      events={events ?? []}
      jobs={jobsWithStage as unknown as import("./agenda-client").AgendaJob[]}
      holds={(holds ?? []) as unknown as import("./calendar-view").CalendarHold[]}
      logs={(logs ?? []) as unknown as import("./day-dialog").DayLog[]}
    />
  )
}
