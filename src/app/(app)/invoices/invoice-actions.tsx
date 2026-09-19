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
import { MoreHorizontal, Download, Send, CheckCircle2, Loader2, DollarSign, Sparkles, Copy, CreditCard, Receipt, Eye } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import type { Invoice } from "@/lib/supabase/types"
import type { InvoiceLang } from "@/lib/invoice-i18n"
import { NF_STATUS_LABELS, canTransition, type NfStatus } from "@/lib/nf-status"
import { NfRequestDialog } from "./nf-request-dialog"
import { NfRegisterDialog } from "./nf-register-dialog"

interface Props {
  invoice: Invoice
  clientEmail: string | null
  paidAmount?: number   // sum of invoice_payments already registered
}

function PaymentDialog({
  invoiceId, invoiceTotal, paidSoFar, currency, open, onClose,
}: {
  invoiceId: string; invoiceTotal: number; paidSoFar: number; currency: string; open: boolean; onClose: () => void
}) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const remaining = invoiceTotal - paidSoFar

  const isForeign = currency !== "BRL"

  const [form, setForm] = useState({
    amount:  remaining > 0 ? remaining : 0,
    paid_at: format(new Date(), "yyyy-MM-dd"),
    method:  isForeign ? "wire" : "pix",
    notes:   "",
    exchange_rate:       "" as string,
    amount_received_brl: "" as string,
    fees:                "" as string,
  })

  // Derive the BRL amount when the rate is typed (and vice-versa is left to the user)
  const rateNum = parseFloat(form.exchange_rate) || 0
  const feesNum = parseFloat(form.fees) || 0
  const suggestedBrl = rateNum > 0 ? Number(((form.amount - feesNum) * rateNum).toFixed(2)) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || form.amount <= 0) { toast.error("Valor inválido"); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const receivedBrl = parseFloat(form.amount_received_brl) || (suggestedBrl || 0)
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      user_id:    user!.id,
      amount:     form.amount,
      paid_at:    form.paid_at,
      method:     form.method as "pix" | "ted" | "cartao" | "boleto" | "wire" | "outro",
      notes:      form.notes || null,
      exchange_rate:       isForeign && rateNum > 0 ? rateNum : null,
      amount_received_brl: isForeign && receivedBrl > 0 ? receivedBrl : null,
      fees:                isForeign && feesNum > 0 ? feesNum : null,
    })

    if (error) { toast.error("Erro ao registrar pagamento"); setLoading(false); return }

    // Money arrived in BRL for a foreign invoice: the NF becomes due and its BRL amount accumulates
    if (isForeign) {
      const { data: inv } = await supabase.from("invoices").select("nf_status, nf_amount_brl").eq("id", invoiceId).single()
      if (inv?.nf_status === "not_required") {
        await supabase.from("invoices").update({ nf_status: "pending", nf_amount_brl: (inv.nf_amount_brl ?? 0) + (receivedBrl > 0 ? receivedBrl : 0) }).eq("id", invoiceId)
      } else if (inv && receivedBrl > 0) {
        await supabase.from("invoices").update({ nf_amount_brl: (inv.nf_amount_brl ?? 0) + receivedBrl }).eq("id", invoiceId)
      }
    }

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
                  {formatCurrency(paidSoFar, currency)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Restante: <span className="font-semibold text-destructive">
                  {formatCurrency(remaining, currency)}
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
                <SelectItem value="wire">Wire / transferência internacional</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isForeign && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium">Câmbio e tarifas (recebimento em {currency})</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tarifas ({currency})</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    value={form.fees} onChange={e => setForm(f => ({ ...f, fees: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Câmbio (R$ por 1 {currency})</Label>
                  <Input type="number" step="0.0001" min="0" placeholder="5.4321"
                    value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Líquido em BRL</Label>
                  <Input type="number" step="0.01" min="0" placeholder={suggestedBrl ? String(suggestedBrl) : "0.00"}
                    value={form.amount_received_brl} onChange={e => setForm(f => ({ ...f, amount_received_brl: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {suggestedBrl > 0
                  ? `Sugerido: (${form.amount} − ${feesNum}) × ${rateNum} = R$ ${suggestedBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Deixe em branco para usar o sugerido.`
                  : "Informe o câmbio ou o valor líquido creditado na sua conta em reais."}
              </p>
            </div>
          )}
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
  const [loading, setLoading]         = useState(false)
  const [payOpen, setPayOpen]         = useState(false)
  const [aiOpen, setAiOpen]           = useState(false)
  const [nfOpen, setNfOpen]           = useState(false)
  const [nfRegisterOpen, setNfRegisterOpen] = useState(false)
  const nfStatus = (invoice.nf_status ?? "not_required") as NfStatus
  const [linkLoading, setLinkLoading] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function setNf(patch: Record<string, unknown>, okMsg: string) {
    const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id)
    if (error) toast.error("Erro ao atualizar NF")
    else { toast.success(okMsg); router.refresh() }
  }

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

  async function generatePaymentLink() {
    setLinkLoading(true)
    const res = await fetch("/api/invoices/payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
    const data = await res.json()
    if (res.ok && data.url) {
      navigator.clipboard.writeText(data.url)
      toast.success("Link de pagamento copiado!")
      window.open(data.url, "_blank")
    } else {
      toast.error(data.error ?? "Erro ao gerar link")
    }
    setLinkLoading(false)
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
          <DropdownMenuItem
            onClick={() => window.open(`/api/invoices/pdf?id=${invoice.id}&inline=1`, "_blank", "noopener")}
            className="pl-6"
          >
            <Eye className="w-3.5 h-3.5" /> Visualizar
          </DropdownMenuItem>
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
          <DropdownMenuItem onClick={generatePaymentLink} disabled={linkLoading} className="text-emerald-600">
            {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Gerar link de pagamento
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAiOpen(true)} className="text-violet-600">
            <Sparkles className="w-4 h-4" />
            Gerar descrição com IA
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Nota fiscal · {NF_STATUS_LABELS[nfStatus] ?? nfStatus}
          </DropdownMenuLabel>
          {canTransition(nfStatus, "requested") && (
            <DropdownMenuItem onClick={() => setNfOpen(true)} className="pl-6">Pedir NF ao contador</DropdownMenuItem>
          )}
          {canTransition(nfStatus, "issued") && (
            <DropdownMenuItem onClick={() => setNfRegisterOpen(true)} className="pl-6">Registrar NF emitida</DropdownMenuItem>
          )}
          {canTransition(nfStatus, "sent") && (
            <DropdownMenuItem onClick={() => setNf({ nf_status: "sent", nf_sent_at: new Date().toISOString() }, "NF marcada como enviada")} className="pl-6">
              Marcar NF enviada ao cliente
            </DropdownMenuItem>
          )}
          {nfStatus === "requested" && (
            <DropdownMenuItem onClick={() => setNf({ nf_status: "pending", nf_requested_at: null }, "Pedido cancelado")} className="pl-6 text-muted-foreground">
              Cancelar pedido
            </DropdownMenuItem>
          )}
          {nfStatus === "not_required" && (
            <DropdownMenuItem onClick={() => setNf({ nf_status: "pending", nf_amount_brl: invoice.nf_amount_brl ?? null }, "NF marcada como pendente")} className="pl-6">
              Marcar NF como pendente
            </DropdownMenuItem>
          )}

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
        currency={invoice.currency}
        open={payOpen}
        onClose={() => setPayOpen(false)}
      />

      <AiDescriptionDialog
        invoiceId={invoice.id}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />

      <NfRequestDialog
        invoiceId={invoice.id}
        open={nfOpen}
        onClose={() => setNfOpen(false)}
      />

      <NfRegisterDialog
        invoiceId={invoice.id}
        currency={invoice.currency}
        defaultAmountBrl={invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : null)}
        open={nfRegisterOpen}
        onClose={() => setNfRegisterOpen(false)}
      />
    </>
  )
}
