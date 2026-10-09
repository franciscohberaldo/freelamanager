"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { effectiveNfSeries, formatNfNumber } from "@/lib/nf-status"
import type { Invoice } from "@/lib/supabase/types"

export function NfCancelDialog({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const number = formatNfNumber(effectiveNfSeries(invoice.nf_series, invoice.nf_issued_at), invoice.nf_number)

  async function recordCancellation() {
    setSaving(true)
    const { data, error } = await createClient().from("invoices")
      .update({ nf_status: "cancelled" }).eq("id", invoice.id)
      .in("nf_status", ["issued", "sent"]).select("id").single()
    setSaving(false)
    if (error || !data) { toast.error("Não foi possível registrar o cancelamento da NF"); return }
    toast.success("Cancelamento da NF registrado")
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={value => !saving && !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cancelamento da NF {number}?</DialogTitle>
          <DialogDescription>
            Registre aqui uma nota que já foi cancelada na prefeitura. Ela continuará no histórico como NF cancelada, com número, emissão e valor preservados. A invoice mantém seu status atual.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Voltar</Button>
          <Button variant="destructive" onClick={recordCancellation} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
