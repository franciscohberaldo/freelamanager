import { createClient } from "@/lib/supabase/server"
import { AccountingTable, type CompetenciaRow } from "./accounting-table"
import { ACCOUNTING_KINDS, type AccountingKind } from "@/lib/accounting-documents"
import type { AccountingDocument } from "@/lib/supabase/types"

export default async function ContabilidadePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("accounting_documents")
    .select("*")
    .eq("user_id", user!.id)
    .order("competencia", { ascending: false })

  const docs = (data ?? []) as AccountingDocument[]

  // One row per competência, carrying how many files of each kind it holds.
  const months = new Map<string, CompetenciaRow>()
  for (const d of docs) {
    const key = d.competencia.slice(0, 7)
    if (!months.has(key)) {
      months.set(key, {
        competencia: key,
        scope: d.scope,
        counts: Object.fromEntries(ACCOUNTING_KINDS.map(k => [k, 0])) as Record<AccountingKind, number>,
        total: 0,
      })
    }
    const row = months.get(key)!
    row.counts[d.kind as AccountingKind]++
    row.total++
    if (d.scope === "year") row.scope = "year"
  }

  const rows = [...months.values()].sort((a, b) => b.competencia.localeCompare(a.competencia))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">Contabilidade</h1>
        <p className="text-muted-foreground text-sm">
          {docs.length} documentos em {rows.length} competências · a guia do DAS de um mês é
          emitida no mês seguinte, e fica na linha do mês a que se refere
        </p>
      </div>

      <AccountingTable rows={rows} />
    </div>
  )
}
