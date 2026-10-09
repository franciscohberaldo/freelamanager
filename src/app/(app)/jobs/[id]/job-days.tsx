import { format, parseISO, isWeekend } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogDialog, type JobOption } from "@/app/(app)/logs/log-dialog"
import { GenerateDaysButton } from "./generate-days-button"
import { DeleteLogButton } from "@/app/(app)/logs/delete-log-button"
import type { SpanJob } from "@/lib/job-days"
import { formatHours } from "@/lib/utils"
import { cn } from "@/lib/utils"

export interface JobDay {
  id: string
  date: string
  hours_billed: number
}

interface Props {
  job: JobOption & SpanJob
  userId: string
  days: JobDay[]
}

/**
 * The days this job was actually worked, month by month, straight from the calendar.
 * Weekends are tinted so a week with Saturday in it reads differently from one without.
 */
export function JobDays({ job, userId, days }: Props) {
  const byMonth = new Map<string, JobDay[]>()
  for (const d of days) {
    const key = d.date.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(d)
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a))
  const totalHours = days.reduce((s, d) => s + d.hours_billed, 0)
  const dayCount = new Set(days.map(d => d.date)).size

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold">Diárias</p>
          <p className="text-sm text-muted-foreground">
            {days.length === 0
              ? "Os dias trabalhados, como registrados no Calendário."
              : `${dayCount} ${dayCount === 1 ? "dia trabalhado" : "dias trabalhados"} · ${formatHours(totalHours)}`}
          </p>
          {dayCount < days.length && <p className="text-xs text-amber-600 mt-1">
            Há {days.length - dayCount} registros extras em datas repetidas. Use a lixeira para excluir os lançamentos incorretos.
          </p>}
        </div>
        <div className="flex items-center gap-2">
          <GenerateDaysButton job={job} userId={userId} existing={days.map(d => d.date)} />
          <LogDialog jobs={[job]} mode="create">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4" />
              Adicionar diária
            </Button>
          </LogDialog>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {job.start_date && job.end_date
            ? <>Nenhuma diária ainda. &ldquo;Gerar do período&rdquo; cria uma por dia do job; &ldquo;Adicionar diária&rdquo; cria uma de cada vez.</>
            : <>Nenhuma diária ainda. Dê datas de início e fim ao job, clique em um dia no <Link href="/agenda" className="underline">Calendário</Link> ou adicione aqui.</>}
        </p>
      ) : (
        <div className="space-y-4">
          {months.map(([month, list]) => (
            <div key={month}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 capitalize">
                {format(parseISO(`${month}-01`), "MMMM yyyy", { locale: ptBR })}
                <span className="normal-case font-normal tracking-normal"> · {new Set(list.map(d => d.date)).size} dias</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map(d => {
                  const date = parseISO(d.date)
                  const weekend = isWeekend(date)
                  return (
                    <div key={d.id} className="group inline-flex items-center rounded-md border">
                    <Link
                      href={`/logs?month=${month}`}
                      title={`${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })} · ${formatHours(d.hours_billed)}`}
                      className={cn(
                        "inline-flex items-baseline gap-1.5 rounded-md px-2 py-1 text-sm tabular transition-colors hover:bg-muted",
                        weekend
                          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          : "bg-card",
                      )}
                    >
                      <span className="text-xs text-muted-foreground capitalize">{format(date, "EEE", { locale: ptBR }).replace(".", "")}</span>
                      <span className="font-medium">{format(date, "dd/MM")}</span>
                      {d.hours_billed > 0 && <span className="text-xs text-muted-foreground">{formatHours(d.hours_billed)}</span>}
                    </Link>
                    <DeleteLogButton logId={d.id} logDate={format(date, "dd/MM/yyyy")} jobName={job.name}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity" />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
