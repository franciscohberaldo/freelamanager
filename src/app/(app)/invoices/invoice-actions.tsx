"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Send, CheckCircle2, Loader2, DollarSign, Sparkles, Copy } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { Invoice } from "@/lib/supabase/types"
import type { InvoiceLang } from "@/lib/invoice-i18n"

interface Props {
  invoice: Invoice
  clientEmail: string | null
  paidAmount?: number   // sum of invoice_payments already registered
}

function PaymentDialog({
  invoiceId, invoiceTotal, paidSoFar, open, onClose,
}: {
  invoiceId: string; invoiceTotal: number; paidSoFar: number; open: boolean; onClose: () => void
}) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const remaining = invoiceTotal - paidSoFar

  const [form, setForm] = useState({
    amount:  remaining > 0 ? remaining : 0,
    paid_at: format(new Date(), "yyyy-MM-dd"),
    method:  "pix",
    notes:   "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || form.amount <= 0) { toast.error("Valor inválido"); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      user_id:    user!.id,
      amount:     form.amount,
      paid_at:    form.paid_at,
      method:     form.method,
      notes:      form.notes || null,
    })

    if (error) { toast.error("Erro ao registrar pagamento"); setLoading(false); return }

    // If fully paid, mark invoice as paid
    const newTotal = paidSoFar + form.amount
    if (newTotal >= invoiceTotal) {
      await supabase.from("invoices").update({ status: "paid", paid_at: form.paid_at }).eq("id", invoiceId)
    }

    toast.success("Pagamento registrado!")
    onClose()
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription className="sr-only">Registrar pagamento parcial ou total do invoice</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {paidSoFar > 0 && (
            <div className="rounded-md border bg-muted/30 px-4 py-2.5 text-sm space-y-1">
              <p className="text-muted-foreground">
                Já pago: <span className="font-semibold text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(paidSoFar)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Restante: <span className="font-semibold text-destructive">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(remaining)}
                </span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor recebido *</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={form.amount || ""}
                onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data do recebimento</Label>
              <Input
                type="date"
                value={form.paid_at}
                onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AiDescriptionDialog({
  invoiceId, open, onClose,
}: { invoiceId: string; open: boolean; onClose: () => void }) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading]           = useState(false)
  const [description, setDescription]   = useState("")
  const [saving, setSaving]             = useState(false)

  async function generate() {
    setLoading(true)
    const res  = await fetch("/api/invoices/ai-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    })
    const data = await res.json()
    if (res.ok) setDescription(data.description)
    else toast.error(data.error ?? "Erro ao gerar descrição")
    setLoading(false)
  }

  async function saveToNotes() {
    setSaving(true)
    const { error } = await supabase.from("invoices").update({ notes: description }).eq("id", invoiceId)
    if (error) toast.error("Erro ao salvar")
    else { toast.success("Descrição salva nas notas!"); router.refresh(); onClose() }
    setSaving(false)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(description)
    toast.success("Copiado!")
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Descrição gerada por IA
          </DialogTitle>
          <DialogDescription className="sr-only">Gerar descrição do invoice com IA</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!description && !loading && (
            <p className="text-sm text-muted-foreground">
              Clique em "Gerar" para criar uma descrição profissional baseada nos itens do invoice.
            </p>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Gerando com Claude AI...</span>
            </div>
          )}
          {description && !loading && (
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={6}
              className="text-sm"
            />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          {description && (
            <>
              <Button type="button" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-4 h-4" /> Copiar
              </Button>
              <Button type="button" onClick={saveToNotes} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar em notas
              </Button>
            </>
          )}
          {!description && (
            <Button type="button" onClick={generate} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Sparkles className="w-4 h-4" /> Gerar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InvoiceActions({ invoice, clientEmail, paidAmount = 0 }: Props) {
  const [loading, setLoading]     = useState(false)
  const [payOpen, setPayOpen]     = useState(false)
  const [aiOpen, setAiOpen]       = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function markPaid() {
    setLoading(true)
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice.id)
    if (error) toast.error("Erro ao atualizar")
    else { toast.success("Marcado como pago!"); router.refresh() }
    setLoading(false)
  }

  async function sendByEmail(lang: InvoiceLang) {
    setLoading(true)
    const res = await fetch("/api/invoices/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, lang }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success("Invoice enviado por e-mail!")
      router.refresh()
    } else {
      toast.error(data.error ?? "Erro ao enviar e-mail")
    }
    setLoading(false)
  }

  async function downloadPdf(lang: InvoiceLang) {
    setLoading(true)
    const res = await fetch(`/api/invoices/pdf?id=${invoice.id}&lang=${lang}`)
    if (!res.ok) { toast.error("Erro ao gerar PDF"); setLoading(false); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `invoice-${invoice.invoice_number}-${lang}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">

          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => downloadPdf("pt")} className="pl-6">
            🇧🇷 Português
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadPdf("en")} className="pl-6">
            🇺🇸 English
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> E-mail
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => sendByEmail("pt")} className="pl-6">
            🇧🇷 Português
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendByEmail("en")} className="pl-6">
            🇺🇸 English
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAiOpen(true)} className="text-violet-600">
            <Sparkles className="w-4 h-4" />
            Gerar descrição com IA
          </DropdownMenuItem>

          {invoice.status !== "paid" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPayOpen(true)} className="text-blue-600">
                <DollarSign className="w-4 h-4" />
                Registrar pagamento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={markPaid} className="text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Marcar como pago
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentDialog
        invoiceId={invoice.id}
        invoiceTotal={invoice.total}
        paidSoFar={paidAmount}
        open={payOpen}
        onClose={() => setPayOpen(false)}
      />

      <AiDescriptionDialog
        invoiceId={invoice.id}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />
    </>
  )
}
