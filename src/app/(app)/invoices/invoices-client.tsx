"use client"

import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CreateInvoiceDialog } from "./create-invoice-dialog"
import { InvoiceActions } from "./invoice-actions"
import { CsvExportButton } from "@/components/csv-export-button"
import { LoadMoreButton } from "@/components/load-more-button"
import { usePaginatedList } from "@/hooks/use-paginated-list"
import { FileText, Plus } from "lucide-react"
import { NF_STATUS_LABELS, type NfStatus } from "@/lib/nf-status"

const statusMap: Record<string, { label: string; variant: "default" | "outline" | "success" | "warning" | "destructive" }> = {
  draft:   { label: "Rascunho", variant: "outline" },
  sent:    { label: "Enviado",  variant: "warning" },
  paid:    { label: "Pago",     variant: "success" },
  overdue: { label: "Vencido",  variant: "destructive" },
}

interface Invoice {
  id: string
  invoice_number: string
  seq_number: string | null
  nf_status: string
  status: string
  period_start: string
  period_end: string
  total_hours_billed: number
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  paid_at: string | null
  created_at: string
  jobs: { name: string; currency: string; clients: { name: string; email: string | null } | null } | null
  [key: string]: unknown
}

interface Job {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  currency: string
  tax_rate: number
  clients: { name: string; email: string | null } | null
}

interface Props {
  invoices: Invoice[]
  invoicesCount: number
  paidMap: Record<string, number>
  jobs: Job[]
}

export function InvoicesClient({ invoices, invoicesCount, paidMap, jobs }: Props) {
  const { items: invoiceList, loadMore, hasMore, loading } = usePaginatedList({
    table: "invoices",
    select: "*, jobs(name, currency, clients(name, email))",
    orderBy: { column: "created_at", ascending: false },
    pageSize: 25,
    initialData: invoices as never[],
    initialCount: invoicesCount,
  })

  const typedList = invoiceList as unknown as Invoice[]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm">{invoicesCount} invoices gerados</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvExportButton
            filename="invoices.csv"
            data={typedList.map(inv => {
              const job = inv.jobs as Invoice["jobs"]
              return {
                numero:   inv.invoice_number,
                status:   inv.status,
                job:      job?.name ?? "",
                cliente:  job?.clients?.name ?? "",
                periodo:  `${inv.period_start} a ${inv.period_end}`,
                horas:    inv.total_hours_billed,
                subtotal: inv.subtotal,
                impostos: inv.tax_amount,
                total:    inv.total,
                moeda:    inv.currency,
                pago_em:  inv.paid_at ?? "",
              }
            })}
            columns={[
              { key: "numero",   label: "Número" },
              { key: "status",   label: "Status" },
              { key: "job",      label: "Job" },
              { key: "cliente",  label: "Cliente" },
              { key: "periodo",  label: "Período" },
              { key: "horas",    label: "Horas Faturadas" },
              { key: "subtotal", label: "Subtotal" },
              { key: "impostos", label: "Impostos" },
              { key: "total",    label: "Total" },
              { key: "moeda",    label: "Moeda" },
              { key: "pago_em",  label: "Pago Em" },
            ]}
          />
          <CreateInvoiceDialog jobs={jobs}>
            <Button><Plus className="w-4 h-4" />Gerar Invoice</Button>
          </CreateInvoiceDialog>
        </div>
      </div>

      <div className="space-y-3">
        {typedList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum invoice gerado ainda.</p>
            </CardContent>
          </Card>
        )}
        {typedList.map((inv) => {
          const job = inv.jobs as Invoice["jobs"]
          const s = statusMap[inv.status] ?? { label: inv.status, variant: "outline" as const }
          return (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{inv.seq_number ?? `#${inv.invoice_number}`}</span>
                    <Badge variant={s.variant as "default"}>{s.label}</Badge>
                    <Badge variant="outline" className="text-[10px]">{NF_STATUS_LABELS[inv.nf_status as NfStatus] ?? inv.nf_status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {job?.name} · {job?.clients?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)} · {inv.total_hours_billed}h faturadas
                  </p>
                  {inv.paid_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      Pago em {formatDate(inv.paid_at)}
                    </p>
                  )}
                  {paidMap[inv.id] && paidMap[inv.id] < inv.total && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Parcial: {formatCurrency(paidMap[inv.id], inv.currency)} de {formatCurrency(inv.total, inv.currency)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{formatCurrency(inv.total, inv.currency)}</p>
                  {inv.tax_amount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Líq: {formatCurrency(inv.subtotal, inv.currency)} + {formatCurrency(inv.tax_amount, inv.currency)} imp.
                    </p>
                  )}
                </div>
                <InvoiceActions invoice={inv as never} clientEmail={job?.clients?.email ?? null} paidAmount={paidMap[inv.id] ?? 0} />
              </CardContent>
            </Card>
          )
        })}
        <LoadMoreButton hasMore={hasMore} loading={loading} onClick={loadMore} />
      </div>
    </div>
  )
}
