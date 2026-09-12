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
    legal_name?: string | null
    cnpj?: string | null
    address?: string | null
    billing_entity?: string | null
    billing_address?: string | null
    nf_rules?: string | null
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
    legal_name:      client?.legal_name ?? "",
    cnpj:            client?.cnpj ?? "",
    address:         client?.address ?? "",
    billing_entity:  client?.billing_entity ?? "",
    billing_address: client?.billing_address ?? "",
    nf_rules:        client?.nf_rules ?? "",
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
      legal_name:      form.legal_name || null,
      cnpj:            form.cnpj || null,
      address:         form.address || null,
      billing_entity:  form.billing_entity || null,
      billing_address: form.billing_address || null,
      nf_rules:        form.nf_rules || null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="pt-2 border-t space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados fiscais (tomador da NF)</p>
            <div className="space-y-2">
              <Label>Razão social</Label>
              <Input value={form.legal_name} onChange={(e) => update("legal_name", e.target.value)} placeholder="Videographica Serviços e Participações Ltda" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>Entidade de cobrança (bill to)</Label>
                <Input value={form.billing_entity} onChange={(e) => update("billing_entity", e.target.value)} placeholder="ex: Steelhead" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço fiscal</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, nº, andar, bairro, CEP, cidade, UF" />
            </div>
            <div className="space-y-2">
              <Label>Endereço de cobrança (se diferente)</Label>
              <Input value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} placeholder="12901 W. Jefferson Blvd, Los Angeles CA 90066, USA" />
            </div>
            <div className="space-y-2">
              <Label>Regras do cliente para a NF</Label>
              <Textarea value={form.nf_rules} onChange={(e) => update("nf_rules", e.target.value)} rows={3} placeholder="ex: sem palavras em inglês, sem nome do job, dados bancários no corpo da NF" />
            </div>
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
