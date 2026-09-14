import { createClient } from "@/lib/supabase/server"
import { JobHistory, type HistoryJob } from "./job-history"

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: history } = await supabase
    .from("jobs")
    .select("*, clients(name, legal_name), invoices(seq_number, invoice_number, nf_number, total, currency, status, nf_status, period_start, period_end, nf_issued_at)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const jobs = (history ?? []) as unknown as HistoryJob[]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de jobs</h1>
        <p className="text-muted-foreground text-sm">
          {jobs.length} jobs com datas, faturamento e notas fiscais
        </p>
      </div>

      <JobHistory jobs={jobs} />
    </div>
  )
}
