import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { AccountingPanel } from "./accounting-panel"
import { formatCompetencia, previousMonth } from "@/lib/accounting-documents"
import { ArrowLeft } from "lucide-react"
import type { AccountingDocument } from "@/lib/supabase/types"
import { PageHeader } from "@/components/page-header"

/** The competência is the month in the URL, as AAAA-MM. */
function parse(value: string): string | null {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null
}

const nextMonth = (competencia: string) => {
  const [y, m] = competencia.split("-").map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
}

export default async function CompetenciaPage({ params }: { params: { competencia: string } }) {
  const competencia = parse(params.competencia)
  if (!competencia) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("accounting_documents")
    .select("*")
    .eq("user_id", user!.id)
    .gte("competencia", `${competencia}-01`)
    .lt("competencia", `${nextMonth(competencia)}-01`)
    .order("uploaded_at", { ascending: false })

  const docs = (data ?? []) as AccountingDocument[]
  const scope = docs.find(d => d.scope === "year")?.scope ?? "month"

  return (
    <div className="px-8 py-6 space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/contabilidade"><ArrowLeft className="w-4 h-4" />Contabilidade</Link>
      </Button>

      <PageHeader
        eyebrow="Financeiro"
        title={<>Competência {formatCompetencia(competencia, scope)}</>}
        description={
          <>
            {docs.length} {docs.length === 1 ? "documento" : "documentos"} · a guia desta
            competência é emitida em {formatCompetencia(nextMonth(competencia))}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contabilidade/${previousMonth(competencia)}`}>
                <ArrowLeft className="w-3 h-3" />
                {formatCompetencia(previousMonth(competencia))}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contabilidade/${nextMonth(competencia)}`}>
                {formatCompetencia(nextMonth(competencia))}
              </Link>
            </Button>
          </>
        }
      />

      <AccountingPanel competencia={competencia} userId={user!.id} documents={docs} />
    </div>
  )
}
