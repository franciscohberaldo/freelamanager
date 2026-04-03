"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface Props {
  children: React.ReactNode
  mode: "create" | "edit"
  client?: {
    id: string
    name: string
    company: string | null
    email: string | null
    phone: string | null
    notes: string | null
  }
}

export function ClientDialog({ children, mode, client }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name:    client?.name ?? "",
    company: client?.company ?? "",
    email:   client?.email ?? "",
    phone:   client?.phone ?? "",
    notes:   client?.notes ?? "",
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return }
    setLoading(true)

    const payload = {
      name:    form.name,
      company: form.company || null,
      email:   form.email || null,
      phone:   form.phone || null,
      notes:   form.notes || null,
    }

    if (mode === "create") {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("clients").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar cliente"); setLoading(false); return }
      toast.success("Cliente criado!")
    } else {
      const { error } = await supabase.from("clients").update(payload).eq("id", client!.id)
      if (error) { toast.error("Erro ao atualizar cliente"); setLoading(false); return }
      toast.success("Cliente atualizado!")
    }

    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Cliente" : "Editar Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nome do contato" />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="email@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Observações..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
