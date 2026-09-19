"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"
import { pathFromPublicUrl, THUMBNAIL_BUCKET } from "@/lib/job-thumbnail"

interface LinkedCounts {
  invoices: number
  logs: number
  documents: number
  events: number
}

interface Props {
  jobId: string
  jobName: string
  thumbnailUrl: string | null
}

/**
 * Danger zone for a job. A job can only be deleted when nothing hangs off it —
 * invoices, daily logs, documents and agenda events all reference the job, and
 * deleting would leave them orphaned. In that case we say what blocks it and
 * suggest marking the job as completed instead.
 */
export function DeleteJobButton({ jobId, jobName, thumbnailUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linked, setLinked] = useState<LinkedCounts | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function openDialog() {
    setOpen(true)
    setChecking(true)
    setLinked(null)
    const head = { count: "exact" as const, head: true }
    const [invoices, logs, documents, events] = await Promise.all([
      supabase.from("invoices").select("*", head).eq("job_id", jobId),
      supabase.from("daily_logs").select("*", head).eq("job_id", jobId),
      supabase.from("job_documents").select("*", head).eq("job_id", jobId),
      supabase.from("agenda_events").select("*", head).eq("job_id", jobId),
    ])
    setLinked({
      invoices: invoices.count ?? 0,
      logs: logs.count ?? 0,
      documents: documents.count ?? 0,
      events: events.count ?? 0,
    })
    setChecking(false)
  }

  const blocked = linked !== null && (linked.invoices + linked.logs + linked.documents + linked.events) > 0

  async function handleDelete() {
    setDeleting(true)

    // Remove the thumbnail file so storage does not keep an orphan
    const path = thumbnailUrl ? pathFromPublicUrl(thumbnailUrl) : null
    if (path) await supabase.storage.from(THUMBNAIL_BUCKET).remove([path])

    const { error } = await supabase.from("jobs").delete().eq("id", jobId)
    if (error) {
      toast.error("Erro ao excluir o job")
      setDeleting(false)
      return
    }
    toast.success(`Job "${jobName}" excluído`)
    router.push("/historico")
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog} className="text-destructive border-destructive/40 hover:bg-destructive/10">
        <Trash2 className="w-4 h-4" />
        Excluir job
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir "{jobName}"?</DialogTitle>
            <DialogDescription className="sr-only">Confirmação de exclusão do job</DialogDescription>
          </DialogHeader>

          {checking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando vínculos do job…
            </div>
          )}

          {!checking && blocked && linked && (
            <div className="space-y-3 text-sm">
              <p>Este job não pode ser excluído porque tem registros ligados a ele:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {linked.invoices > 0 && <li>{linked.invoices} invoice{linked.invoices > 1 ? "s" : ""}</li>}
                {linked.logs > 0 && <li>{linked.logs} diária{linked.logs > 1 ? "s" : ""}/registro{linked.logs > 1 ? "s" : ""}</li>}
                {linked.documents > 0 && <li>{linked.documents} documento{linked.documents > 1 ? "s" : ""}</li>}
                {linked.events > 0 && <li>{linked.events} tarefa{linked.events > 1 ? "s" : ""} na agenda</li>}
              </ul>
              <p className="text-muted-foreground">
                Para tirá-lo das listas sem perder o histórico, marque o job como <strong>Concluído</strong> no formulário acima.
              </p>
            </div>
          )}

          {!checking && linked && !blocked && (
            <p className="text-sm text-muted-foreground">
              Este job não tem invoices, diárias, documentos nem tarefas ligados.
              A exclusão é permanente e não pode ser desfeita.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            {!checking && linked && !blocked && (
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir permanentemente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
