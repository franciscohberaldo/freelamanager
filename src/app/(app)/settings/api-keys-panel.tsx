"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Trash2, Copy, Eye, EyeOff, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"

interface ApiKey {
  id: string; name: string; key_prefix: string; is_active: boolean
  last_used: string | null; created_at: string
}

interface Props { apiKeys: ApiKey[] }

export function ApiKeysPanel({ apiKeys: initial }: Props) {
  const supabase  = createClient()
  const router    = useRouter()
  const [keys, setKeys]       = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName]       = useState("")
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey]   = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error("Nome obrigatório"); return }
    setLoading(true)

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? "Erro"); setLoading(false); return }

    setNewKey(data.key)
    setLoading(false)
    router.refresh()
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revogar esta API key?")) return
    const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", id)
    if (error) { toast.error("Erro ao revogar"); return }
    setKeys(k => k.map(x => x.id === id ? { ...x, is_active: false } : x))
    toast.success("API key revogada")
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar esta API key? Esta ação é irreversível.")) return
    const { error } = await supabase.from("api_keys").delete().eq("id", id)
    if (error) { toast.error("Erro ao deletar"); return }
    setKeys(k => k.filter(x => x.id !== id))
    toast.success("API key deletada")
  }

  function closeCreate() {
    setCreateOpen(false)
    setNewKey(null)
    setName("")
    setShowKey(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Use API keys para acessar seus dados via <code className="text-xs bg-muted px-1 rounded">/api/v1/*</code>
        </p>
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova key
        </Button>
      </div>

      {keys.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma API key criada ainda.</p>
      )}

      <div className="space-y-2">
        {keys.map(k => (
          <div key={k.id} className="flex items-center justify-between gap-3 border rounded-lg px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{k.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {k.key_prefix}••••••••
                {k.last_used && ` · último uso: ${format(parseISO(k.last_used), "dd/MM/yyyy")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!k.is_active && (
                <span className="text-xs text-destructive font-medium">Revogada</span>
              )}
              {k.is_active && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRevoke(k.id)}>
                  Revogar
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(k.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={v => !v && closeCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{newKey ? "API key criada!" : "Nova API key"}</DialogTitle>
            <DialogDescription className="sr-only">Criar nova API key para integração</DialogDescription>
          </DialogHeader>

          {!newKey ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da key *</Label>
                <Input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ex: Zapier, Make, Meu script..." required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreate}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  Copie agora — esta key não será exibida novamente!
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white border rounded px-2 py-1.5 flex-1 font-mono break-all">
                    {showKey ? newKey : `${newKey.slice(0, 12)}${"•".repeat(newKey.length - 12)}`}
                  </code>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowKey(s => !s)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copiado!") }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use no header: <code className="bg-muted px-1 rounded">Authorization: Bearer {"{sua-key}"}</code>
              </p>
              <DialogFooter>
                <Button onClick={closeCreate}>Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
