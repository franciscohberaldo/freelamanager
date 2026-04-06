"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2, Send, Loader2, Zap } from "lucide-react"
import { format, parseISO } from "date-fns"
import { WEBHOOK_EVENTS } from "@/lib/webhook-events"

interface Webhook {
  id: string; name: string; url: string; events: string[]
  is_active: boolean; last_fired: string | null; secret: string
}

interface Props { webhooks: Webhook[] }

export function WebhooksPanel({ webhooks: initial }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const [hooks, setHooks]     = useState(initial)
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<Webhook | undefined>()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const defaultForm = { name: "", url: "", events: [] as string[] }
  const [form, setForm] = useState(defaultForm)

  function openNew() { setEditing(undefined); setForm(defaultForm); setOpen(true) }
  function openEdit(h: Webhook) {
    setEditing(h)
    setForm({ name: h.name, url: h.url, events: h.events as string[] })
    setOpen(true)
  }

  function toggleEvent(ev: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) { toast.error("Nome e URL obrigatórios"); return }
    if (!form.events.length) { toast.error("Selecione ao menos um evento"); return }
    setLoading(true)

    if (editing) {
      const { error } = await supabase.from("webhooks").update({
        name: form.name, url: form.url, events: form.events,
      }).eq("id", editing.id)
      if (error) { toast.error("Erro ao atualizar"); setLoading(false); return }
      setHooks(h => h.map(x => x.id === editing.id ? { ...x, ...form } : x))
      toast.success("Webhook atualizado!")
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from("webhooks").insert({
        user_id: user!.id, name: form.name, url: form.url, events: form.events,
      }).select().single()
      if (error || !data) { toast.error("Erro ao criar"); setLoading(false); return }
      setHooks(h => [...h, data as Webhook])
      toast.success("Webhook criado!")
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function handleToggleActive(id: string, current: boolean) {
    const { error } = await supabase.from("webhooks").update({ is_active: !current }).eq("id", id)
    if (error) { toast.error("Erro"); return }
    setHooks(h => h.map(x => x.id === id ? { ...x, is_active: !current } : x))
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar este webhook?")) return
    const { error } = await supabase.from("webhooks").delete().eq("id", id)
    if (error) { toast.error("Erro"); return }
    setHooks(h => h.filter(x => x.id !== id))
    toast.success("Webhook deletado")
  }

  async function handleTest(hook: Webhook) {
    setTesting(hook.id)
    const res = await fetch("/api/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookId: hook.id }),
    })
    const data = await res.json()
    if (res.ok) toast.success(`Teste enviado! Status: ${data.status_code ?? "?"}`)
    else toast.error(data.error ?? "Erro ao testar")
    setTesting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Receba notificações em tempo real para eventos do sistema
        </p>
        <Button size="sm" className="gap-2" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Novo webhook
        </Button>
      </div>

      {hooks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum webhook configurado.</p>
      )}

      <div className="space-y-2">
        {hooks.map(h => (
          <div key={h.id} className="border rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Switch checked={h.is_active} onCheckedChange={() => handleToggleActive(h.id, h.is_active)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{h.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => handleTest(h)} disabled={testing === h.id || !h.is_active}>
                  {testing === h.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => openEdit(h)}>
                  <Zap className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                  onClick={() => handleDelete(h.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(h.events as string[]).map(ev => (
                <span key={ev} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                  {ev}
                </span>
              ))}
              {h.last_fired && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Último disparo: {format(parseISO(h.last_fired), "dd/MM HH:mm")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar webhook" : "Novo webhook"}</DialogTitle>
            <DialogDescription className="sr-only">Configurar webhook de saída</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Notificação Slack" required />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://hooks.slack.com/..." type="url" required />
            </div>
            <div className="space-y-2">
              <Label>Eventos *</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.events.includes(ev)}
                      onChange={() => toggleEvent(ev)} className="rounded" />
                    <code className="text-xs">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
