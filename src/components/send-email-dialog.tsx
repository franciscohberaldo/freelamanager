"use client"

/**
 * Before anything leaves, show what will be sent: who gets it (to/cc), the subject, the
 * message (editable, opened on a default text) and the invoice PDF that goes attached.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Send, Paperclip, Eye } from "lucide-react"
import { validateEmailList } from "@/lib/emails"
import type { InvoiceLang } from "@/lib/invoice-i18n"

export function SendEmailDialog({
  invoiceId, lang, open, onClose, onSent,
}: {
  invoiceId: string
  lang: InvoiceLang
  open: boolean
  onClose: () => void
  /** Extra work after a successful send (e.g. archiving the PDF into the job's documents). */
  onSent?: () => void | Promise<void>
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<{ to: string[]; cc: string[]; subject: string; text: string; fileName: string } | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [extraTo, setExtraTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setPreview(null)
    setSubject("")
    setBody("")
    setExtraTo("")
    setLoading(true)
    fetch(`/api/invoices/send-preview?invoiceId=${invoiceId}&lang=${lang}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error(d.error); onClose(); return }
        setPreview(d)
        setSubject(d.subject)
        setBody(d.text)
      })
      .catch(() => { toast.error("Erro ao carregar o preview"); onClose() })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId, lang])

  const extraCheck = validateEmailList(extraTo)

  async function send() {
    if (!extraCheck.ok) { toast.error(extraCheck.error); return }
    if (!subject.trim()) { toast.error("O assunto não pode ficar vazio"); return }
    if (!body.trim()) { toast.error("O texto do e-mail não pode ficar vazio"); return }
    setSending(true)
    const res = await fetch("/api/invoices/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, lang, subject: subject.trim(), body, extraTo }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao enviar e-mail")
      setSending(false)
      return
    }
    toast.success("Invoice enviado por e-mail!")
    await onSent?.()
    setSending(false)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar invoice — {lang === "pt" ? "Português" : "English"}</DialogTitle>
          <DialogDescription className="sr-only">Confirme os destinatários e o conteúdo antes de enviar</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Montando o e-mail...</span>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="text-sm space-y-1 rounded-md border bg-muted/30 px-4 py-3">
              <p><span className="text-muted-foreground">Para: </span>
                {preview.to.length > 0
                  ? <span className="font-medium">{preview.to.join(", ")}</span>
                  : <span className="text-destructive font-medium">nenhum destinatário</span>}
              </p>
              {preview.cc.length > 0 && (
                <p><span className="text-muted-foreground">Cc: </span>{preview.cc.join(", ")}</p>
              )}
            </div>

            {preview.to.length === 0 && extraTo.trim() === "" && (
              <p className="text-xs text-destructive">
                Preencha o e-mail do cliente, marque um contato para receber as invoices ou adicione um destinatário extra abaixo.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="send-subject" className="text-xs">Assunto</Label>
                <Input id="send-subject" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="send-extra" className="text-xs">Destinatário extra (opcional)</Label>
                <Input
                  id="send-extra"
                  value={extraTo}
                  onChange={e => setExtraTo(e.target.value)}
                  placeholder="email@empresa.com"
                  className={!extraCheck.ok ? "border-destructive" : undefined}
                />
                <p className="text-[11px] text-muted-foreground">
                  {extraCheck.ok
                    ? "Vários separados por vírgula. Ao enviar, viram contatos do cliente marcados para invoices."
                    : extraCheck.error}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send-body" className="text-xs">Texto do e-mail</Label>
              <Textarea
                id="send-body"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={11}
                className="text-sm leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{preview.fileName}</span>
                <span className="text-muted-foreground shrink-0">anexado</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/api/invoices/pdf?id=${invoiceId}&lang=${lang}&inline=1`, "_blank", "noopener")}
              >
                <Eye className="w-3 h-3" />
                Ver PDF
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button onClick={send} disabled={sending || loading || !preview || (preview.to.length === 0 && extraTo.trim() === "") || !extraCheck.ok}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
