"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Trash2 } from "lucide-react"

interface Props {
  logId: string
  logDate: string
  jobName: string
}

/**
 * Deletes a daily-log entry. A log already billed on an invoice (invoice_items.log_id)
 * cannot be deleted — removing it would silently break the invoice's audit trail.
 */
export function DeleteLogButton({ logId, logDate, jobName }: Props) {
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [billedOn, setBilledOn] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function openDialog() {
    setOpen(true)
    setChecking(true)
    setBilledOn(null)
    const { data: items } = await supabase
      .from("invoice_items")
      .select("invoice_id")
      .eq("log_id", logId)
      .limit(1)
    if (items && items.length > 0) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("id", items[0].invoice_id)
        .single()
      setBilledOn(inv?.invoice_number ?? "desconhecido")
    }
    setChecking(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from("daily_logs").delete().eq("id", logId)
    if (error) {
      toast.error("Erro ao excluir o registro")
      setDeleting(false)
      return
    }
    toast.success("Registro excluído")
    setOpen(false)
    setDeleting(false)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="ghost" size="sm"
        className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
        title="Excluir registro"
        onClick={openDialog}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir registro de {logDate}?</DialogTitle>
            <DialogDescription className="sr-only">Confirmação de exclusão do registro diário</DialogDescription>
          </DialogHeader>

          {checking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando vínculos…
            </div>
          )}

          {!checking && billedOn && (
            <p className="text-sm text-muted-foreground">
              Esta diária de <strong>{jobName}</strong> já foi faturada no invoice <strong>#{billedOn}</strong> e
              não pode ser excluída — removê-la quebraria o rastreio do invoice.
              Se o lançamento estiver errado, edite o registro ou ajuste o invoice.
            </p>
          )}

          {!checking && !billedOn && (
            <p className="text-sm text-muted-foreground">
              O registro de <strong>{jobName}</strong> em <strong>{logDate}</strong> será excluído
              permanentemente. Essa ação não pode ser desfeita.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            {!checking && !billedOn && (
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
