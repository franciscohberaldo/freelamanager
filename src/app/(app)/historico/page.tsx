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
    .select("*, clients(name, legal_name), job_documents(kind), invoices(seq_number, invoice_number, nf_number, total, currency, status, nf_status, period_start, period_end, nf_issued_at)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const jobs = (history ?? []) as unknown as HistoryJob[]

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
