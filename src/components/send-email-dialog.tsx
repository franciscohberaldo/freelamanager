"use client"

/**
 * Before anything leaves, show exactly what will be sent: who gets it (to/cc), the
 * subject and the rendered body — the same HTML the send route uses.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Send } from "lucide-react"
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
  const [preview, setPreview] = useState<{ to: string[]; cc: string[]; subject: string; html: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setPreview(null)
    setLoading(true)
    fetch(`/api/invoices/send-preview?invoiceId=${invoiceId}&lang=${lang}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error(d.error); onClose(); return }
        setPreview(d)
      })
      .catch(() => { toast.error("Erro ao carregar o preview"); onClose() })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId, lang])

  async function send() {
    setSending(true)
    const res = await fetch("/api/invoices/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, lang }),
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
              <p><span className="text-muted-foreground">Assunto: </span>{preview.subject}</p>
            </div>

            {preview.to.length === 0 && (
              <p className="text-xs text-destructive">
                Preencha o e-mail do cliente ou marque um contato para receber as invoices antes de enviar.
              </p>
            )}

            <iframe
              sandbox=""
              srcDoc={preview.html}
              title="Preview do e-mail"
              className="w-full h-96 rounded-md border bg-white"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button onClick={send} disabled={sending || loading || !preview || preview.to.length === 0}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
