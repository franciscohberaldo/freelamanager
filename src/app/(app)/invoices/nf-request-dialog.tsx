"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Send } from "lucide-react"

/** Asks for the NF of one invoice, or — when the job has none — of the job itself. */
export function NfRequestDialog({ invoiceId, jobId, open, onClose }: {
  invoiceId?: string
  jobId?: string
  open: boolean
  onClose: () => void
}) {
  const target = invoiceId ? `invoiceId=${invoiceId}` : `jobId=${jobId}`
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/invoices/nf-request?${target}`)
      .then(r => r.json())
      .then(d => { if (d.error) toast.error(d.error); else { setTo(d.to); setSubject(d.subject); setBody(d.body) } })
      .catch(() => toast.error("Erro ao montar o pedido"))
      .finally(() => setLoading(false))
  }, [open, target])

  async function send() {
    setSending(true)
    const res = await fetch("/api/invoices/nf-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, jobId, subject, body }),
    })
    const d = await res.json()
    if (res.ok) { toast.success("Pedido enviado ao contador"); router.refresh(); onClose() }
    else toast.error(d.error ?? "Erro ao enviar")
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedir NF ao contador</DialogTitle>
          <DialogDescription>{to ? `Para: ${to}` : "Cadastre o e-mail do contador em Configurações."}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assunto</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Textarea rows={16} className="font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={send} disabled={sending || loading || !to}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
