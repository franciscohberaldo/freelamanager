import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency, formatDate, formatHours, JOB_STATUS_LABELS } from "@/lib/utils"
import { workHoursInLocal } from "@/lib/timezone"
import { JobForm } from "../job-form"
import { JobDocumentsPanel } from "./job-documents-panel"
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
  const localHours = workHoursInLocal(typedJob.work_hours, typedJob.timezone)

  const loggedHours = jobLogs.reduce((sum, l) => sum + (l.hours_billed ?? 0), 0)
  const loggedValue = jobLogs.reduce((sum, l) => sum + (l.total_value ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/jobs"><ArrowLeft className="w-4 h-4" />Jobs</Link>
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
            {perDay
              ? `${formatCurrency(typedJob.daily_rate, typedJob.currency)}/dia`
              : `${formatCurrency(typedJob.hourly_rate, typedJob.currency)}/h`}
            {typedJob.start_date && ` · ${formatDate(typedJob.start_date)}`}
            {typedJob.end_date && ` – ${formatDate(typedJob.end_date)}`}
            {typedJob.project_code && ` · ${typedJob.project_code}`}
            {localHours && ` · ${localHours.remoteLabel} = ${localHours.localLabel}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos
            {docs.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{docs.length}/6</span>}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            {jobInvoices.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{jobInvoices.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="registros">
            Registros
            {jobLogs.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{jobLogs.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 max-w-3xl">
          <JobForm clients={clients ?? []} job={typedJob} mode="edit" />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <JobDocumentsPanel jobId={typedJob.id} userId={user!.id} documents={docs} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
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
        </TabsContent>

        <TabsContent value="registros" className="mt-4 space-y-4">
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
                <p className="text-xs text-muted-foreground">Valor lançado</p>
                <p className="text-xl font-semibold">{formatCurrency(loggedValue, typedJob.currency)}</p>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
