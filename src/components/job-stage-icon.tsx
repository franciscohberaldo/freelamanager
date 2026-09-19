import { CircleDollarSign, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { JOB_STAGE_LABELS, type JobStage } from "@/lib/job-stage"

/** A stick figure mid-stride: the job is still being worked. */
export function RunnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="15" cy="4" r="2" />
      <path d="M13.5 8 9 10.5 7 14" />
      <path d="M13.5 8 15 12l-3 3-1.5 5" />
      <path d="M15 12l3 1 2 3" />
      <path d="M9 10.5 5 11" />
    </svg>
  )
}

/**
 * The job's stage as one glyph: the runner while it is being worked, a red cross with the
 * name of the first pending step, a green coin when the money is in.
 */
export function JobStageIcon({ stage, withLabel = true, className }: { stage: JobStage; withLabel?: boolean; className?: string }) {
  if (stage === "work") {
    return (
      <span className={cn("inline-flex items-center gap-1", className)} title={JOB_STAGE_LABELS.work}>
        <RunnerIcon className="w-3.5 h-3.5 shrink-0" />
      </span>
    )
  }
  if (stage === "done") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400", className)} title={JOB_STAGE_LABELS.done}>
        <CircleDollarSign className="w-3.5 h-3.5 shrink-0" />
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400", className)} title={`Pendente: ${JOB_STAGE_LABELS[stage]}`}>
      <X className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
      {withLabel && <span className="text-[10px] font-semibold uppercase tracking-wide">{JOB_STAGE_LABELS[stage]}</span>}
    </span>
  )
}
