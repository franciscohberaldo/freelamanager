"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import {
  DOCUMENT_KINDS, DOCUMENT_LABELS, DOCUMENT_HINTS, DOCUMENT_BUCKET,
  validateDocument, documentPath, formatFileSize, type DocumentKind,
} from "@/lib/job-documents"
import type { JobDocument } from "@/lib/supabase/types"
import { FileText, Loader2, Trash2, Upload, ExternalLink } from "lucide-react"

interface Props {
  jobId: string
  userId: string
  documents: JobDocument[]
  /** What a kind can do besides holding a file — asking the accountant for the NF, say. */
  actions?: Partial<Record<DocumentKind, React.ReactNode>>
}

export function JobDocumentsPanel({ jobId, userId, documents, actions }: Props) {
  const [busy, setBusy] = useState<DocumentKind | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const byKind = new Map(documents.map(d => [d.kind as DocumentKind, d]))

  async function onPick(kind: DocumentKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""                       // let the same file be picked again after a failure
    if (!file) return

    const check = validateDocument(file)
    if (!check.ok) { toast.error(check.error); return }

    setBusy(kind)
    const existing = byKind.get(kind)
    const path = documentPath(userId, jobId, kind, file.name)

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { toast.error("Erro ao enviar o arquivo"); setBusy(null); return }

    const { error } = await supabase.from("job_documents").upsert({
      user_id: userId, job_id: jobId, kind,
      path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
    }, { onConflict: "job_id,kind" })
    if (error) { toast.error("Erro ao registrar o arquivo"); setBusy(null); return }

    // A replacement under a different extension leaves the old object behind.
    if (existing && existing.path !== path) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([existing.path])
    }

    toast.success(`${DOCUMENT_LABELS[kind]} enviado`)
    setBusy(null)
    router.refresh()
  }

  async function onOpen(doc: JobDocument) {
    // The bucket is private, so reading needs a short-lived signed URL.
    const { data, error } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(doc.path, 60)
    if (error || !data) { toast.error("Erro ao abrir o arquivo"); return }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function onRemove(doc: JobDocument) {
    setBusy(doc.kind as DocumentKind)
    const { error } = await supabase.from("job_documents").delete().eq("id", doc.id)
    if (error) { toast.error("Erro ao remover"); setBusy(null); return }
    await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.path])
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DOCUMENT_KINDS.map(kind => {
        const doc = byKind.get(kind)
        const loading = busy === kind

        return (
          <Card key={kind} className={doc ? "" : "border-dashed"}>
            <CardContent className="py-4 px-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{DOCUMENT_LABELS[kind]}</p>
                  <p className="text-xs text-muted-foreground">{DOCUMENT_HINTS[kind]}</p>
                </div>
                <FileText className={`w-4 h-4 shrink-0 ${doc ? "text-foreground" : "text-muted-foreground/30"}`} />
              </div>

              {actions?.[kind]}

              {doc ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => onOpen(doc)}
                    className="flex items-center gap-1.5 text-sm hover:underline text-left min-w-0 w-full"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{doc.file_name}</span>
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size_bytes)} · enviado em {formatDate(doc.uploaded_at)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={loading} asChild>
                      <label className="cursor-pointer">
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Trocar
                        <input
                          type="file" className="hidden" disabled={loading}
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={e => onPick(kind, e)}
                        />
                      </label>
                    </Button>
                    <Button
                      variant="ghost" size="sm" disabled={loading}
                      onClick={() => onRemove(doc)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={loading} asChild>
                  <label className="cursor-pointer">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Enviar arquivo
                    <input
                      type="file" className="hidden" disabled={loading}
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={e => onPick(kind, e)}
                    />
                  </label>
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}

      <p className="text-xs text-muted-foreground sm:col-span-2">
        PDF, PNG ou JPG, até 10 MB. Os arquivos ficam em um bucket privado — o link de
        visualização vale por um minuto.
      </p>
    </div>
  )
}
