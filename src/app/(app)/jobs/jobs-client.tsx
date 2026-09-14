"use client"

import { formatCurrency } from "@/lib/utils"
import { workHoursInLocal } from "@/lib/timezone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { JobDialog } from "./job-dialog"
import { LoadMoreButton } from "@/components/load-more-button"
import { usePaginatedList } from "@/hooks/use-paginated-list"
import { JOB_STATUS_LABELS } from "@/lib/utils"
import Link from "next/link"
import { Plus, Building2, History } from "lucide-react"

const statusVariant: Record<string, "default" | "success" | "warning" | "outline" | "destructive"> = {
  proposal: "outline",
  active: "success",
  paused: "warning",
  completed: "secondary" as "default",
}

interface Job {
  id: string
  name: string
  status: string
  is_recurring: boolean
  hourly_rate: number
  daily_rate: number
  billing_mode?: "hourly" | "daily"
  project_code?: string | null
  timezone?: string | null
  work_hours?: string | null
  is_confidential?: boolean
  end_client?: string | null
  intermediary?: string | null
  currency: string
  created_at: string
  clients: { name: string } | null
  [key: string]: unknown
}

interface Client {
  id: string
  name: string
}

interface Props {
  jobs: Job[]
  jobsCount: number
  clients: Client[]
}

export function JobsClient({ jobs, jobsCount, clients }: Props) {
  const { items: jobList, loadMore, hasMore, loading } = usePaginatedList({
    table: "jobs",
    select: "*, clients(name)",
    orderBy: { column: "created_at", ascending: false },
    pageSize: 25,
    initialData: jobs as never[],
    initialCount: jobsCount,
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-muted-foreground text-sm">{jobsCount} jobs cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/historico">
              <History className="w-4 h-4" />
              Histórico
            </Link>
          </Button>
          <JobDialog clients={clients} mode="create">
            <Button>
              <Plus className="w-4 h-4" />
              Novo Job
            </Button>
          </JobDialog>
        </div>
      </div>

      <div className="grid gap-4">
        {(jobList as unknown as Job[]).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum job cadastrado ainda.</p>
            </CardContent>
          </Card>
        )}
        {(jobList as unknown as Job[]).map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{job.name}</span>
                  <Badge variant={statusVariant[job.status] ?? "outline"}>
                    {JOB_STATUS_LABELS[job.status]}
                  </Badge>
                  {job.is_recurring && <Badge variant="outline">Recorrente</Badge>}
                  {job.is_confidential && <Badge variant="destructive" title="Confidencial: não divulgar o trabalho">NDA</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(job.clients as { name: string } | null)?.name}
                  {job.intermediary && ` · via ${job.intermediary}`}
                  {job.end_client && ` · ${job.end_client}`}
                  {job.currency !== "BRL" && ` · ${job.currency}`}
                  {(() => { const lh = workHoursInLocal(job.work_hours, job.timezone); return lh ? ` · ${lh.remoteLabel} = ${lh.localLabel}` : "" })()}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                {job.billing_mode === "daily" ? (
                  <>
                    <p className="text-sm font-medium">{formatCurrency(job.daily_rate, job.currency)}/dia</p>
                    {job.project_code && (
                      <p className="text-xs text-muted-foreground font-mono">{job.project_code}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">{formatCurrency(job.hourly_rate, job.currency)}/h</p>
                    {job.daily_rate > 0 && (
                      <p className="text-xs text-muted-foreground">{formatCurrency(job.daily_rate, job.currency)}/dia</p>
                    )}
                  </>
                )}
              </div>
              <JobDialog clients={clients} job={job as never} mode="edit">
                <Button variant="ghost" size="sm">Editar</Button>
              </JobDialog>
            </CardContent>
          </Card>
        ))}
        <LoadMoreButton hasMore={hasMore} loading={loading} onClick={loadMore} />
      </div>
    </div>
  )
}
