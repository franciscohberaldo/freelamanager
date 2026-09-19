import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate, JOB_STATUS_LABELS } from "@/lib/utils"
import { workHoursInLocal } from "@/lib/timezone"
import { JobForm } from "../job-form"
import { DeleteJobButton } from "./delete-job-button"
import { JobDocumentsPanel } from "./job-documents-panel"
import { NfRequestAction, type SentRequest } from "./nf-request-action"
import { InvoiceDocAction } from "./invoice-doc-action"
import { InvoiceActions } from "@/app/(app)/invoices/invoice-actions"
import { rateOf, rateLabel } from "@/lib/billing-mode"
import { canTransition, formatNfNumber, effectiveNfSeries, type NfStatus } from "@/lib/nf-status"
import { ArrowLeft, FileText, Image as ImageIcon } from "lucide-react"
import type { Job, JobDocument, Invoice } from "@/lib/supabase/types"
import { PageHeader } from "@/components/page-header"

const statusVariant: Record<string, "default" | "success" | "warning" | "outline"> = {
  proposal: "outline", active: "success", paused: "warning", completed: "default",
}

const invoiceVariant: Record<string, "default" | "success" | "warning" | "outline" | "destructive"> = {
  draft: "outline", sent: "warning", paid: "success", overdue: "destructive",
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", sent: "Enviada", paid: "Paga", overdue: "Atrasada",
}

export default async function JobPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: job } = await supabase
    .from("jobs")
    .select("*, clients(id, name, legal_name, email)")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle()

  if (!job) notFound()

  const [{ data: clients }, { data: documents }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("user_id", user!.id).order("name"),
    supabase.from("job_documents").select("*").eq("job_id", params.id),
    supabase.from("invoices").select("*").eq("job_id", params.id).order("period_start", { ascending: false }),
  ])

  const typedJob = job as unknown as Job & { clients: { id: string; name: string; legal_name: string | null; email: string | null } | null }
  const docs = (documents ?? []) as JobDocument[]
  const jobInvoices = (invoices ?? []) as Invoice[]

  const client = typedJob.clients
  const localHours = workHoursInLocal(typedJob.work_hours, typedJob.timezone)

  // Every request about this job: the ones made from it, and the ones about its invoices.
  const invoiceIds = jobInvoices.map(i => i.id)
  const requestSelect = "id, created_at, sent_to, subject, body, status, error"
  const [{ data: byJob }, { data: byInvoice }] = await Promise.all([
    supabase.from("nf_requests").select(requestSelect).eq("job_id", params.id),
    invoiceIds.length
      ? supabase.from("nf_requests").select(requestSelect).in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as SentRequest[] }),
  ])
  const nfRequests = [...(byJob ?? []), ...(byInvoice ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at)) as SentRequest[]

  // only an invoice still waiting on its NF can be sent to the accountant
  const nfCandidates = jobInvoices
    .filter(i => canTransition((i.nf_status ?? "not_required") as NfStatus, "requested"))
    .map(i => ({ id: i.id, label: i.seq_number ?? i.invoice_number }))

  return (
    <div className="px-8 py-6 space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/historico"><ArrowLeft className="w-4 h-4" />Histórico</Link>
      </Button>

      <div className="flex items-start gap-4">
        <div className="w-28 h-20 rounded border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
          {typedJob.thumbnail_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={typedJob.thumbnail_url} alt="" className="w-full h-full object-cover" />
            : <ImageIcon className="w-6 h-6 text-muted-foreground/40" />}
        </div>
        <PageHeader
          eyebrow="Operação"
          className="flex-1 mb-0"
          title={
            <span className="flex items-center gap-2 flex-wrap">
              {typedJob.name}
              <Badge variant={statusVariant[typedJob.status] ?? "outline"}>
                {JOB_STATUS_LABELS[typedJob.status] ?? typedJob.status}
              </Badge>
              {typedJob.is_recurring && <Badge variant="outline">Recorrente</Badge>}
              {typedJob.is_confidential && (
                <Badge variant="destructive" title="Confidencial: não divulgar o trabalho">NDA</Badge>
              )}
            </span>
          }
          description={
            <>
              <p>
                {client?.legal_name ?? client?.name ?? "Sem cliente"}
                {typedJob.intermediary && ` · via ${typedJob.intermediary}`}
                {typedJob.end_client && ` · ${typedJob.end_client}`}
              </p>
              <p>
                {`${formatCurrency(rateOf(typedJob), typedJob.currency)}${rateLabel(typedJob.billing_mode)}`}
                {typedJob.start_date && ` · ${formatDate(typedJob.start_date)}`}
                {typedJob.end_date && ` – ${formatDate(typedJob.end_date)}`}
                {typedJob.project_code && ` · ${typedJob.project_code}`}
                {localHours && ` · ${localHours.remoteLabel} = ${localHours.localLabel}`}
              </p>
            </>
          }
        />
      </div>

      <section id="dados" className="space-y-3">
        <h2 className="text-lg font-semibold">Dados</h2>
        <div className="max-w-3xl">
          <JobForm clients={clients ?? []} job={typedJob} mode="edit" />
        </div>
        <div className="max-w-3xl pt-4 mt-2 border-t flex justify-end">
          <DeleteJobButton jobId={typedJob.id} jobName={typedJob.name} thumbnailUrl={typedJob.thumbnail_url} />
        </div>
      </section>

      <section id="documentos" className="space-y-3">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <JobDocumentsPanel
          jobId={typedJob.id}
          userId={user!.id}
          documents={docs}
          actions={{
            invoice: (
              <InvoiceDocAction
                userId={user!.id}
                job={{
                  id: typedJob.id,
                  name: typedJob.name,
                  hourly_rate: typedJob.hourly_rate,
                  daily_rate: typedJob.daily_rate,
                  contract_value: typedJob.contract_value,
                  billing_mode: typedJob.billing_mode,
                  project_code: typedJob.project_code,
                  po_number: typedJob.po_number,
                  currency: typedJob.currency,
                  tax_rate: typedJob.tax_rate,
                  clients: typedJob.clients
                    ? { name: typedJob.clients.name, email: typedJob.clients.email }
                    : null,
                }}
                invoices={jobInvoices.map(i => ({
                  id: i.id,
                  seq_number: i.seq_number,
                  invoice_number: i.invoice_number,
                  status: i.status,
                  currency: i.currency,
                }))}
              />
            ),
            accountant_email: (
              <NfRequestAction jobId={typedJob.id} candidates={nfCandidates} sent={nfRequests} />
            ),
          }}
          done={{ accountant_email: nfRequests.some(r => r.status !== "failed") }}
        />
      </section>

      <section id="invoices" className="space-y-3">
        <h2 className="text-lg font-semibold">Invoices</h2>
        {jobInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma invoice para este job.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Nº</th>
                  <th className="p-2 text-left">Período</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">NF</th>
                  <th className="p-2 w-12"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {jobInvoices.map(inv => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-2 font-mono">{inv.seq_number ?? inv.invoice_number}</td>
                    <td className="p-2 whitespace-nowrap">
                      {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="p-2">
                      <Badge variant={invoiceVariant[inv.status] ?? "outline"}>
                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono">
                      {inv.nf_number ? formatNfNumber(effectiveNfSeries(inv.nf_series, inv.nf_issued_at), inv.nf_number) : <span className="text-muted-foreground font-sans">—</span>}
                    </td>
                    <td className="p-1 text-right">
                      <InvoiceActions invoice={inv} clientEmail={client?.email ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          O menu de cada linha faz o mesmo que em <Link href="/invoices" className="underline">Invoices</Link>: PDF, e-mail, NF, pagamento e exclusão.
        </p>
      </section>
    </div>
  )
}
