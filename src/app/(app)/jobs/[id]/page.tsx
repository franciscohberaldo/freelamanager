import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate, formatHours, JOB_STATUS_LABELS } from "@/lib/utils"
import { workHoursInLocal } from "@/lib/timezone"
import { JobForm } from "../job-form"
import { JobDocumentsPanel } from "./job-documents-panel"
import { SectionNav } from "./section-nav"
import { NfRequestAction } from "./nf-request-action"
import { DOCUMENT_KINDS } from "@/lib/job-documents"
import { rateOf, rateLabel } from "@/lib/billing-mode"
import { canTransition, type NfStatus } from "@/lib/nf-status"
import { ArrowLeft, FileText, Image as ImageIcon } from "lucide-react"
import type { Job, JobDocument, Invoice, DailyLog } from "@/lib/supabase/types"

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
    .select("*, clients(id, name, legal_name)")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle()

  if (!job) notFound()

  const [{ data: clients }, { data: documents }, { data: invoices }, { data: logs }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("user_id", user!.id).order("name"),
    supabase.from("job_documents").select("*").eq("job_id", params.id),
    supabase.from("invoices").select("*").eq("job_id", params.id).order("period_start", { ascending: false }),
    supabase.from("daily_logs").select("*").eq("job_id", params.id).order("date", { ascending: false }),
  ])

  const typedJob = job as unknown as Job & { clients: { id: string; name: string; legal_name: string | null } | null }
  const docs = (documents ?? []) as JobDocument[]
  const jobInvoices = (invoices ?? []) as Invoice[]
  const jobLogs = (logs ?? []) as DailyLog[]

  const client = typedJob.clients
  const perDay = typedJob.billing_mode === "daily"
  const perProject = typedJob.billing_mode === "fixed"
  const localHours = workHoursInLocal(typedJob.work_hours, typedJob.timezone)

  const loggedHours = jobLogs.reduce((sum, l) => sum + (l.hours_billed ?? 0), 0)
  const loggedValue = jobLogs.reduce((sum, l) => sum + (l.total_value ?? 0), 0)

  // only an invoice still waiting on its NF can be sent to the accountant
  const nfCandidates = jobInvoices
    .filter(i => canTransition((i.nf_status ?? "not_required") as NfStatus, "requested"))
    .map(i => ({ id: i.id, label: i.seq_number ?? i.invoice_number }))

  const sections = [
    { id: "dados", label: "Dados" },
    { id: "documentos", label: "Documentos", count: docs.length ? `${docs.length}/${DOCUMENT_KINDS.length}` : undefined },
    { id: "invoices", label: "Invoices", count: jobInvoices.length ? String(jobInvoices.length) : undefined },
    { id: "registros", label: "Registros", count: jobLogs.length ? String(jobLogs.length) : undefined },
  ]

  return (
    <div className="p-6 space-y-6">
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
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{typedJob.name}</h1>
            <Badge variant={statusVariant[typedJob.status] ?? "outline"}>
              {JOB_STATUS_LABELS[typedJob.status] ?? typedJob.status}
            </Badge>
            {typedJob.is_recurring && <Badge variant="outline">Recorrente</Badge>}
            {typedJob.is_confidential && (
              <Badge variant="destructive" title="Confidencial: não divulgar o trabalho">NDA</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {client?.legal_name ?? client?.name ?? "Sem cliente"}
            {typedJob.intermediary && ` · via ${typedJob.intermediary}`}
            {typedJob.end_client && ` · ${typedJob.end_client}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {`${formatCurrency(rateOf(typedJob), typedJob.currency)}${rateLabel(typedJob.billing_mode)}`}
            {typedJob.start_date && ` · ${formatDate(typedJob.start_date)}`}
            {typedJob.end_date && ` – ${formatDate(typedJob.end_date)}`}
            {typedJob.project_code && ` · ${typedJob.project_code}`}
            {localHours && ` · ${localHours.remoteLabel} = ${localHours.localLabel}`}
          </p>
        </div>
      </div>

      <SectionNav sections={sections} />

      <section id="dados" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold">Dados</h2>
        <div className="max-w-3xl">
          <JobForm clients={clients ?? []} job={typedJob} mode="edit" />
        </div>
      </section>

      <section id="documentos" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <JobDocumentsPanel
          jobId={typedJob.id}
          userId={user!.id}
          documents={docs}
          actions={{
            accountant_email: (
              <NfRequestAction jobId={typedJob.id} candidates={nfCandidates} />
            ),
          }}
        />
      </section>

      <section id="invoices" className="scroll-mt-24 space-y-3">
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
                      {inv.nf_number ?? <span className="text-muted-foreground font-sans">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Invoices são criadas e editadas em <Link href="/invoices" className="underline">Invoices</Link>.
        </p>
      </section>

      <section id="registros" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold">Registros</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground">Faturável lançado</p>
              <p className="text-xl font-semibold">
                {perDay ? `${(loggedHours / 8).toLocaleString("pt-BR")} dias` : formatHours(loggedHours)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-muted-foreground">
                {perProject ? "Valor do projeto" : "Valor lançado"}
              </p>
              <p className="text-xl font-semibold">
                {formatCurrency(perProject ? (typedJob.contract_value ?? 0) : loggedValue, typedJob.currency)}
              </p>
              {perProject && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preço fechado; as horas abaixo são só o tempo gasto.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {jobLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Nenhum registro para este job.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-right">{perDay ? "Dias" : "Horas"}</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-left">Reuniões / pedidos</th>
                </tr>
              </thead>
              <tbody>
                {jobLogs.slice(0, 30).map(log => (
                  <tr key={log.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatDate(log.date)}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {perDay ? (log.hours_billed / 8).toLocaleString("pt-BR") : formatHours(log.hours_billed)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {formatCurrency(log.total_value, typedJob.currency)}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {[log.meetings, log.requests].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobLogs.length > 30 && (
              <p className="p-2 text-xs text-muted-foreground border-t">
                Mostrando os 30 mais recentes de {jobLogs.length}.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
