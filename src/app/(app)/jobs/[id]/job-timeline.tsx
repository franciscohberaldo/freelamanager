import { Check } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { jobSteps, jobStage, type StageJob, type StageInvoice, type StageDocument } from "@/lib/job-stage"
import { RunnerIcon } from "@/components/job-stage-icon"

interface Props {
  job: StageJob
  invoices: StageInvoice[]
  documents: StageDocument[]
}

/**
 * The job's life on one line: work, invoice, NF, DAS, money. Settled steps are filled and
 * dated; the current one is ringed in violet; the rest wait in grey.
 */
export function JobTimeline({ job, invoices, documents }: Props) {
  const steps = jobSteps(job, invoices, documents)
  const stage = jobStage(job, invoices, documents)
  const doneCount = steps.filter(s => s.done).length

  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-semibold">Linha do tempo</p>
        <p className="text-sm text-muted-foreground">
          {stage === "done" ? "Tudo fechado" : stage === "work" ? "Em andamento" : `Próximo passo: ${steps.find(s => s.stage === stage)?.label}`}
          <span className="tabular"> · {doneCount}/{steps.length}</span>
        </p>
      </div>

      <ol className="flex items-start">
        {steps.map((s, i) => {
          const current = s.stage === stage
          const last = i === steps.length - 1
          return (
            <li key={s.stage} className={cn("flex-1 min-w-0 flex flex-col items-center text-center", !last && "relative")}>
              {/* the rail to the next step, coloured up to the last settled one */}
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 left-1/2 right-[-50%] h-0.5",
                    s.done && steps[i + 1].done ? "bg-emerald-500" : s.done ? "bg-primary/60" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 bg-card",
                  s.done ? "border-emerald-500 bg-emerald-500 text-white"
                    : current ? "border-primary text-primary"
                    : "border-border text-muted-foreground/60",
                )}
              >
                {s.done ? <Check className="w-4 h-4" strokeWidth={3} />
                  : s.stage === "work" ? <RunnerIcon className="w-4 h-4" />
                  : <span className="text-xs font-semibold tabular">{i + 1}</span>}
              </span>
              <p className={cn("mt-2 text-sm font-medium", !s.done && !current && "text-muted-foreground")}>{s.label}</p>
              <p className="text-xs text-muted-foreground tabular h-4">
                {s.done && s.at ? formatDate(s.at) : current ? "agora" : ""}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
