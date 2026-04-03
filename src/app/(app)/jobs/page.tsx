import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { JobDialog } from "./job-dialog"
import { JOB_STATUS_LABELS } from "@/lib/utils"
import { Plus, Building2 } from "lucide-react"

const statusVariant: Record<string, "default" | "success" | "warning" | "outline" | "destructive"> = {
  proposal: "outline",
  active: "success",
  paused: "warning",
  completed: "secondary" as "default",
}

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, clients(name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", user!.id)
    .order("name")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-muted-foreground text-sm">{jobs?.length ?? 0} jobs cadastrados</p>
        </div>
        <JobDialog clients={clients ?? []} mode="create">
          <Button>
            <Plus className="w-4 h-4" />
            Novo Job
          </Button>
        </JobDialog>
      </div>

      <div className="grid gap-4">
        {jobs?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum job cadastrado ainda.</p>
            </CardContent>
          </Card>
        )}
        {jobs?.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{job.name}</span>
                  <Badge variant={statusVariant[job.status] ?? "outline"}>
                    {JOB_STATUS_LABELS[job.status]}
                  </Badge>
                  {job.is_recurring && <Badge variant="outline">Recorrente</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(job.clients as { name: string } | null)?.name}
                  {job.currency !== "BRL" && ` · ${job.currency}`}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-sm font-medium">{formatCurrency(job.hourly_rate, job.currency)}/h</p>
                {job.daily_rate > 0 && (
                  <p className="text-xs text-muted-foreground">{formatCurrency(job.daily_rate, job.currency)}/dia</p>
                )}
              </div>
              <JobDialog clients={clients ?? []} job={job} mode="edit">
                <Button variant="ghost" size="sm">Editar</Button>
              </JobDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
