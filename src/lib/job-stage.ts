/**
 * Where a job is in its life, read off what already exists: the work itself, then the
 * invoice, the money, the nota fiscal (issued once the money is in) and the DAS. Nothing
 * is stored — the stage is a fact about the records the job already has, so it can never
 * fall out of date.
 */

export const JOB_STAGES = ["work", "invoice", "payment", "nf", "das", "done"] as const
export type JobStage = (typeof JOB_STAGES)[number]

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  work:    "Em andamento",
  invoice: "Invoice",
  payment: "Recebimento",
  nf:      "NF",
  das:     "DAS",
  done:    "Recebido",
}

export interface StageJob {
  status: string
  end_date?: string | null
}

export interface StageInvoice {
  status: string
  nf_status?: string | null
  sent_at?: string | null
  paid_at?: string | null
  nf_issued_at?: string | null
  created_at?: string | null
}

export interface StageDocument {
  kind: string
  uploaded_at?: string | null
}

/** One step of the timeline: done or not, and when it happened if it did. */
export interface StageStep {
  stage: Exclude<JobStage, "done">
  label: string
  done: boolean
  at: string | null
}

const SENT = new Set(["sent", "paid", "overdue"])
const NF_DONE = new Set(["issued", "sent"])

const earliest = (dates: (string | null | undefined)[]) =>
  dates.filter((d): d is string => !!d).sort()[0] ?? null

/** The five steps in order — the money comes before the NF, which is issued after it. */
export function jobSteps(job: StageJob, invoices: StageInvoice[], documents: StageDocument[]): StageStep[] {
  const doc = (kind: string) => documents.find(d => d.kind === kind)
  const workDone = job.status === "completed"
  const sent     = invoices.filter(i => SENT.has(i.status))
  const nfs      = invoices.filter(i => NF_DONE.has(i.nf_status ?? ""))
  const paid     = invoices.filter(i => i.status === "paid")

  return [
    { stage: "work",    label: "Trabalho",    done: workDone,                              at: workDone ? job.end_date ?? null : null },
    { stage: "invoice", label: "Invoice",     done: sent.length > 0 || !!doc("invoice"),   at: earliest([...sent.map(i => i.sent_at ?? i.created_at), doc("invoice")?.uploaded_at]) },
    { stage: "payment", label: "Recebimento", done: paid.length > 0 || !!doc("payment_proof"), at: earliest([...paid.map(i => i.paid_at), doc("payment_proof")?.uploaded_at]) },
    { stage: "nf",      label: "NF",          done: nfs.length > 0 || !!doc("nf"),         at: earliest([...nfs.map(i => i.nf_issued_at), doc("nf")?.uploaded_at]) },
    { stage: "das",     label: "DAS",         done: !!doc("das_paid"),                     at: doc("das_paid")?.uploaded_at ?? null },
  ]
}

/**
 * The one thing to say about the job right now: still being worked, or the first step
 * after the work that is not settled, or done.
 */
export function jobStage(job: StageJob, invoices: StageInvoice[], documents: StageDocument[]): JobStage {
  const steps = jobSteps(job, invoices, documents)
  if (!steps[0].done) return "work"
  const pending = steps.slice(1).find(s => !s.done)
  return pending ? pending.stage : "done"
}
