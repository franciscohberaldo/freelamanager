"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { formatFileSize } from "@/lib/job-documents"
import {
  ACCOUNTING_KINDS, ACCOUNTING_LABELS, ACCOUNTING_HINTS, ACCOUNTING_BUCKET,
  validateAccountingFile, accountingPath, type AccountingKind,
} from "@/lib/accounting-documents"
import type { AccountingDocument } from "@/lib/supabase/types"
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react"

interface Props {
  competencia: string
  userId: string
  documents: AccountingDocument[]
}

export function AccountingPanel({ competencia, userId, documents }: Props) {
  const [busy, setBusy] = useState<AccountingKind | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const byKind = new Map<AccountingKind, AccountingDocument[]>()
  for (const d of documents) {
    const k = d.kind as AccountingKind
    byKind.set(k, [...(byKind.get(k) ?? []), d])
  }

  async function onPick(kind: AccountingKind, e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ""                       // let the same file be picked again after a failure
    if (files.length === 0) return

    setBusy(kind)
    for (const file of files) {
      const check = validateAccountingFile(file)
      if (!check.ok) { toast.error(`${file.name}: ${check.error}`); continue }

      const id = crypto.randomUUID()
      const path = accountingPath(userId, competencia, kind, id, file.name)

      const { error: uploadError } = await supabase.storage
        .from(ACCOUNTING_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) { toast.error(`Erro ao enviar ${file.name}`); continue }

      const { error } = await supabase.from("accounting_documents").insert({
        user_id: userId, competencia: `${competencia}-01`,
        scope: kind.startsWith("dasn") ? "year" : "month",
        kind, path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      })
      if (error) { toast.error(`Erro ao registrar ${file.name}`); continue }
    }

    setBusy(null)
    router.refresh()
  }

  async function onOpen(doc: AccountingDocument) {
    // The bucket is private, so reading needs a short-lived signed URL.
    const { data, error } = await supabase.storage
      .from(ACCOUNTING_BUCKET)
      .createSignedUrl(doc.path, 60)
    if (error || !data) { toast.error("Erro ao abrir o arquivo"); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function onRemove(doc: AccountingDocument) {
    setBusy(doc.kind as AccountingKind)
    const { error } = await supabase.from("accounting_documents").delete().eq("id", doc.id)
    if (error) { toast.error("Erro ao remover"); setBusy(null); return }
    await supabase.storage.from(ACCOUNTING_BUCKET).remove([doc.path])
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ACCOUNTING_KINDS.map(kind => {
        const docs = byKind.get(kind) ?? []
        const loading = busy === kind

        return (
          <Card key={kind} className={docs.length > 0 ? "" : "border-dashed"}>
            <CardContent className="py-4 px-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {ACCOUNTING_LABELS[kind]}
                    {docs.length > 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{docs.length}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{ACCOUNTING_HINTS[kind]}</p>
                </div>
                <FileText className={`w-4 h-4 shrink-0 ${docs.length > 0 ? "text-foreground" : "text-muted-foreground/30"}`} />
              </div>

              {docs.map(doc => (
                <div key={doc.id} className="space-y-1 border-l-2 pl-2">
                  <button
                    type="button"
                    onClick={() => onOpen(doc)}
                    className="flex items-center gap-1.5 text-sm hover:underline text-left min-w-0 w-full"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{doc.file_name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size_bytes)} · {formatDate(doc.uploaded_at)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemove(doc)}
                      disabled={loading}
                      className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      remover
                    </button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" disabled={loading} asChild>
                <label className="cursor-pointer">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {docs.length > 0 ? "Enviar outro" : "Enviar arquivo"}
                  <input
                    type="file" className="hidden" disabled={loading} multiple
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={e => onPick(kind, e)}
                  />
                </label>
              </Button>
            </CardContent>
          </Card>
        )
      })}

      <p className="text-xs text-muted-foreground sm:col-span-2">
        PDF, PNG ou JPG, até 10 MB. Cada tipo aceita mais de um arquivo — um mês pode ter
        dois extratos, ou uma guia recalculada ao lado da original. Os arquivos ficam em um
        bucket privado; o link de visualização vale por um minuto.
      </p>
    </div>
  )
}
