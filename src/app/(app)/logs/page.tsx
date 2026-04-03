import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate, formatHours } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LogDialog } from "./log-dialog"
import { LogFilters } from "./log-filters"
import { Plus, ClipboardList } from "lucide-react"
import { format, startOfMonth, endOfMonth } from "date-fns"

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { month?: string; job_id?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthParam = searchParams.month ?? format(now, "yyyy-MM")
  const [year, month] = monthParam.split("-").map(Number)
  const monthStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd")
  const monthEnd = format(new Date(year, month, 0), "yyyy-MM-dd")

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, hourly_rate, daily_rate, currency, clients(name)")
    .eq("user_id", user!.id)
    .in("status", ["active", "paused"])
    .order("name")

  let query = supabase
    .from("daily_logs")
    .select("*, jobs(name, hourly_rate, currency, clients(name))")
    .eq("user_id", user!.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false })

  if (searchParams.job_id) {
    query = query.eq("job_id", searchParams.job_id)
  }

  const { data: logs } = await query

  const totals = logs?.reduce(
    (acc, l) => ({
      worked: acc.worked + l.hours_worked,
      billed: acc.billed + l.hours_billed,
      value: acc.value + l.total_value,
    }),
    { worked: 0, billed: 0, value: 0 }
  ) ?? { worked: 0, billed: 0, value: 0 }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registro Diário</h1>
          <p className="text-muted-foreground text-sm">
            {logs?.length ?? 0} registros · {formatHours(totals.billed)} faturadas · {formatCurrency(totals.value)}
          </p>
        </div>
        <LogDialog jobs={(jobs ?? []) as any} mode="create">
          <Button><Plus className="w-4 h-4" />Novo Registro</Button>
        </LogDialog>
      </div>

      <LogFilters jobs={jobs ?? []} currentMonth={monthParam} currentJobId={searchParams.job_id} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{formatHours(totals.worked)}</p>
            <p className="text-xs text-muted-foreground">Trabalhadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{formatHours(totals.billed)}</p>
            <p className="text-xs text-muted-foreground">Faturadas (NF)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(totals.value)}</p>
            <p className="text-xs text-muted-foreground">Total do período</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs list */}
      <div className="space-y-3">
        {logs?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum registro neste período.</p>
            </CardContent>
          </Card>
        )}
        {logs?.map((log) => {
          const job = log.jobs as unknown as { name: string; hourly_rate: number; currency: string; clients: { name: string } | null } | null
          return (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">
                        {formatDate(log.date, "EEE, dd/MM")}
                      </span>
                      <span className="font-semibold">{job?.name}</span>
                      <span className="text-xs text-muted-foreground">{job?.clients?.name}</span>
                    </div>
                    {log.meetings && (
                      <p className="text-sm text-muted-foreground mt-1 ml-23">
                        <span className="font-medium">Reuniões:</span> {log.meetings}
                      </p>
                    )}
                    {log.requests && (
                      <p className="text-sm text-muted-foreground mt-0.5 ml-23">
                        <span className="font-medium">Pedidos:</span> {log.requests}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center gap-3 justify-end">
                      <span className="text-xs text-muted-foreground">{formatHours(log.hours_worked)} trab.</span>
                      <span className="text-xs font-medium">{formatHours(log.hours_billed)} fat.</span>
                      <span className="font-semibold">{formatCurrency(log.total_value, job?.currency)}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <LogDialog jobs={(jobs ?? []) as any} log={log} mode="duplicate">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Duplicar</Button>
                      </LogDialog>
                      <LogDialog jobs={(jobs ?? []) as any} log={log} mode="edit">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
                      </LogDialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
