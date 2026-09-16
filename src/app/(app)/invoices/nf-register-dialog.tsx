"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { NF_SERIES_LABELS, formatNfNumber, normalizeNfNumber, seriesForDate, type NfSeries } from "@/lib/nf-status"

export function NfRegisterDialog({
  invoiceId, currency, defaultAmountBrl, open, onClose,
}: {
  invoiceId: string; currency: string; defaultAmountBrl: number | null; open: boolean; onClose: () => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => {
    const today = format(new Date(), "yyyy-MM-dd")
    return {
      nf_series: seriesForDate(today),
      nf_number: "",
      nf_issued_at: today,
      nf_amount_brl: defaultAmountBrl ? String(defaultAmountBrl) : "",
    }
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const nfNumber = normalizeNfNumber(form.nf_number)
    if (!nfNumber) { toast.error("Informe o número da NF"); return }
    setLoading(true)
    const { error } = await supabase.from("invoices").update({
      nf_status: "issued",
      nf_series: form.nf_series,
      nf_number: nfNumber,
      nf_issued_at: form.nf_issued_at,
      nf_amount_brl: parseFloat(form.nf_amount_brl) || defaultAmountBrl,
    }).eq("id", invoiceId)
    if (error) {
      toast.error(error.message.includes("idx_invoices_user_nf") ? "Já existe uma NF com esse número nessa série" : "Erro ao registrar NF")
    } else {
      toast.success("NF registrada")
      router.refresh()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar NF emitida</DialogTitle>
          <DialogDescription className="sr-only">Número, série e data da nota</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Série</Label>
              <Select value={form.nf_series} onValueChange={v => setForm(f => ({ ...f, nf_series: v as NfSeries }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(k => <SelectItem key={k} value={k}>{NF_SERIES_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Número da NF</Label>
              <Input value={form.nf_number} onChange={e => setForm(f => ({ ...f, nf_number: e.target.value }))} placeholder="ex: 0030" />
              {normalizeNfNumber(form.nf_number) && (
                <p className="text-xs text-muted-foreground font-mono">
                  Fica: {formatNfNumber(form.nf_series, form.nf_number)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Data de emissão</Label>
              <Input type="date" value={form.nf_issued_at} onChange={e => setForm(f => ({ ...f, nf_issued_at: e.target.value, nf_series: seriesForDate(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Valor da NF (R$)</Label>
              <Input type="number" step="0.01" value={form.nf_amount_brl} onChange={e => setForm(f => ({ ...f, nf_amount_brl: e.target.value }))} placeholder={currency === "BRL" ? "= total" : "líquido recebido"} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin" />} Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
