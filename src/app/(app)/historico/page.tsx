import { createClient } from "@/lib/supabase/server"
import { JobHistory, type HistoryJob } from "./job-history"
import { JobDialog } from "../jobs/job-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("name")

  const { data: history } = await supabase
    .from("jobs")
    .select("*, clients(name, legal_name), job_documents(kind), invoices(id, seq_number, invoice_number, nf_number, total, currency, status, nf_status, period_start, period_end, nf_issued_at)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  // A request points either at the job or at one of its invoices; both end up on the job.
  const { data: requests } = await supabase
    .from("nf_requests")
    .select("job_id, invoice_id, created_at, status")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const rows = (history ?? []) as unknown as HistoryJob[]
  const jobOfInvoice = new Map<string, string>()
  for (const job of rows) {
    for (const inv of job.invoices ?? []) if (inv.id) jobOfInvoice.set(inv.id, job.id)
  }

  const sentByJob = new Map<string, { created_at: string; status: string }[]>()
  for (const r of requests ?? []) {
    const jobId = r.job_id ?? (r.invoice_id ? jobOfInvoice.get(r.invoice_id) : null)
    if (!jobId) continue
    sentByJob.set(jobId, [...(sentByJob.get(jobId) ?? []), { created_at: r.created_at, status: r.status }])
  }

  const jobs = rows.map(job => ({ ...job, nf_requests: sentByJob.get(job.id) ?? [] }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Histórico de jobs</h1>
          <p className="text-muted-foreground text-sm">
            {jobs.length} jobs com datas, faturamento e notas fiscais
          </p>
        </div>
        <JobDialog clients={clients ?? []} mode="create">
          <Button>
            <Plus className="w-4 h-4" />
            Novo Job
          </Button>
        </JobDialog>
      </div>

      <JobHistory jobs={jobs} />
    </div>
  )
}
