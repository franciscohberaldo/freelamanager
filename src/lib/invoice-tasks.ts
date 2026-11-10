import { jobStage, type StageDocument, type StageInvoice, type StageJob } from "@/lib/job-stage"

/** A completed job whose work has not yet produced an invoice is an open task. */
export interface InvoiceStageJob extends StageJob {
  invoices?: StageInvoice[] | null
  job_documents?: StageDocument[] | null
}

export function jobsNeedingInvoice<T extends InvoiceStageJob>(jobs: T[]): T[] {
  return jobs.filter(job => jobStage(job, job.invoices ?? [], job.job_documents ?? []) === "invoice")
}

/** DAS becomes a task only after the previous job stages are settled. */
export function jobsNeedingDas<T extends InvoiceStageJob>(jobs: T[]): T[] {
  return jobs.filter(job => jobStage(job, job.invoices ?? [], job.job_documents ?? []) === "das")
}
