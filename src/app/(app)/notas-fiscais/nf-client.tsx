"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { NF_STATUS_LABELS, NF_SERIES_LABELS, formatNfNumber, effectiveNfSeries, isNfOverdue, type NfStatus, type NfSeries } from "@/lib/nf-status"
import { findGaps, findDuplicates, formatSeqNumber } from "@/lib/nf-sequence"
import { InvoiceActions } from "../invoices/invoice-actions"
import type { Invoice } from "@/lib/supabase/types"
import { PageHeader } from "@/components/page-header"

export type NfRow = Invoice & { jobs: { name: string; clients: { name: string; legal_name: string | null } | null } | null }

const STATUS_VARIANT: Record<NfStatus, "outline" | "warning" | "default" | "success" | "destructive"> = {
  not_required: "outline", pending: "warning", requested: "default", issued: "success", sent: "success",
}

const overdueSince = (r: NfRow) => r.nf_requested_at ?? r.sent_at ?? r.created_at

export function NfClient({ rows }: { rows: NfRow[] }) {
  const [status, setStatus] = useState<"all" | NfStatus>("all")
  const [series, setSeries] = useState<"all" | NfSeries>("all")
  const [year, setYear] = useState<string>("all")
  const years = useMemo(
    () => Array.from(new Set(rows.map(r => (r.nf_issued_at ?? r.created_at).slice(0, 4)))).sort().reverse(),
    [rows],
  )

  const visible = rows
    .filter(r => r.nf_status !== "not_required")
    .filter(r => status === "all" || r.nf_status === status)
    .filter(r => series === "all" || r.nf_series === series)
    .filter(r => year === "all" || (r.nf_issued_at ?? r.created_at).startsWith(year))

  // Paulínia notes are imported with an "NFP" prefix and are not part of the invoice sequence
  const seqValues = rows.filter(r => !r.seq_number?.startsWith("NFP")).map(r => r.seq_number)
  const seqGaps = findGaps(seqValues)
  const seqDups = findDuplicates(seqValues)
  const nfAlerts = (Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(s => {
    const nums = rows.filter(r => r.nf_series === s).map(r => r.nf_number)
    return { series: s, gaps: findGaps(nums), dups: findDuplicates(nums) }
  }).filter(a => a.gaps.length || a.dups.length)

  const overdue = visible.filter(r => isNfOverdue(r.nf_status, overdueSince(r)))
  const fmtGap = (g: { from: number; to: number }) => g.from === g.to ? String(g.from) : `${g.from}–${g.to}`

  return (
    <div className="px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Notas fiscais"
        description={<>{visible.length} invoices com NF · {overdue.length} acumuladas há mais de 7 dias</>}
      />

      {(seqGaps.length > 0 || seqDups.length > 0 || nfAlerts.length > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm space-y-1">
            {seqGaps.length > 0 && <p>Lacunas na sequência de invoices: {seqGaps.map(fmtGap).join(", ")}</p>}
            {seqDups.length > 0 && <p>Invoices duplicadas: {seqDups.join(", ")}</p>}
            {nfAlerts.map(a => (
              <p key={a.series}>
                {NF_SERIES_LABELS[a.series]}: {a.gaps.length > 0 && `lacunas ${a.gaps.map(fmtGap).join(", ")}`}
                {a.gaps.length > 0 && a.dups.length > 0 && " · "}
                {a.dups.length > 0 && `duplicadas ${a.dups.join(", ")}`}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(NF_STATUS_LABELS) as NfStatus[]).filter(s => s !== "not_required").map(s => (
              <SelectItem key={s} value={s}>{NF_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={series} onValueChange={v => setSeries(v as typeof series)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as séries</SelectItem>
            {(Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(s => <SelectItem key={s} value={s}>{NF_SERIES_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-2">Invoice</th>
              <th className="text-left p-2">NF</th>
              <th className="text-left p-2">Emissão</th>
              <th className="text-left p-2">Tomador</th>
              <th className="text-right p-2">Valor (R$)</th>
              <th className="text-left p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => {
              const late = isNfOverdue(r.nf_status, overdueSince(r))
              return (
                <tr key={r.id} className={`border-t ${late ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <td className="p-2 font-mono">{formatSeqNumber(r.seq_number, r.invoice_number)}</td>
                  <td className="p-2 font-mono">{r.nf_number ? formatNfNumber(effectiveNfSeries(r.nf_series, r.nf_issued_at), r.nf_number) : "—"}</td>
                  <td className="p-2">{r.nf_issued_at ? formatDate(r.nf_issued_at) : "—"}</td>
                  <td className="p-2">
                    {r.jobs?.clients?.legal_name ?? r.jobs?.clients?.name ?? "—"}
                    <span className="text-muted-foreground"> · {r.jobs?.name}</span>
                  </td>
                  <td className="p-2 text-right">
                    {r.nf_amount_brl != null ? formatCurrency(r.nf_amount_brl) : (r.currency === "BRL" ? formatCurrency(r.total) : "—")}
                  </td>
                  <td className="p-2">
                    <Badge variant={STATUS_VARIANT[r.nf_status]}>{NF_STATUS_LABELS[r.nf_status]}</Badge>
                    {late && <span className="ml-1 text-xs text-red-600">atrasada</span>}
                  </td>
                  <td className="p-2 text-right"><InvoiceActions invoice={r} clientEmail={null} paidAmount={0} /></td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma nota nesse filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
