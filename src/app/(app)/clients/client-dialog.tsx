"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { normalizeName } from "@/lib/text-case"
import { formatCnpj, isValidCnpj } from "@/lib/cnpj"
import { parseEmails, validateEmailList } from "@/lib/emails"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Search } from "lucide-react"

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
    state_registration?: string | null
    address?: string | null
    billing_entity?: string | null
    billing_address?: string | null
    nf_rules?: string | null
  }
}

/** Two lines, because that is how the address reaches the accountant. */
const ADDRESS_PLACEHOLDER =
  "Av. Manuel Bandeira, 360\nCEP: 05317-020 – Vila Leopoldina – São Paulo"

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
    state_registration: client?.state_registration ?? "",
    address:         client?.address ?? "",
    billing_entity:  client?.billing_entity ?? "",
    billing_address: client?.billing_address ?? "",
    nf_rules:        client?.nf_rules ?? "",
  })

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const [lookingUp, setLookingUp] = useState(false)

  /**
   * The Receita's record wins for the legal name and the address — that is what the lookup
   * is for. The contact fields are the user's own, so they are only filled when empty.
   */
  async function lookupCnpj() {
    if (!isValidCnpj(form.cnpj)) { toast.error("Digite um CNPJ válido"); return }
    setLookingUp(true)
    try {
      const res = await fetch(`/api/cnpj?cnpj=${encodeURIComponent(form.cnpj)}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Não deu para buscar"); return }

      setForm(f => ({
        ...f,
        cnpj:       data.cnpj || f.cnpj,
        legal_name: data.legal_name || f.legal_name,
        address:    data.address || f.address,
        name:       f.name.trim() || data.company || data.legal_name || "",
        company:    f.company.trim() || data.company || "",
        email:      f.email.trim() || data.email || "",
        phone:      f.phone.trim() || data.phone || "",
      }))

      if (data.active) toast.success(`${data.legal_name} · ${data.situacao}`)
      else toast.warning(`${data.legal_name} · situação cadastral: ${data.situacao}`)
    } catch {
      toast.error("Não deu para buscar")
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return }
    const emailCheck = validateEmailList(form.email)
    if (!emailCheck.ok) { toast.error(emailCheck.error); return }
    setLoading(true)

    const payload = {
      name:    normalizeName(form.name),
      company: normalizeName(form.company) || null,
      email:   parseEmails(form.email).join(", ") || null,
      phone:   form.phone || null,
      notes:   form.notes || null,
      legal_name:      normalizeName(form.legal_name) || null,
      cnpj:            form.cnpj || null,
      state_registration: form.state_registration.trim() || null,
      address:         form.address || null,
      billing_entity:  normalizeName(form.billing_entity) || null,
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
            <Input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@empresa.com, outro@empresa.com"
            />
            <p className="text-xs text-muted-foreground">
              Aceita mais de um, separados por vírgula. O primeiro recebe a invoice; os
              outros entram em cópia.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="pt-2 border-t space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados fiscais (tomador da NF)</p>
            <div className="space-y-2">
              <Label>Razão social</Label>
              <Input value={form.legal_name} onChange={(e) => update("legal_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => update("cnpj", e.target.value)}
                    onBlur={(e) => update("cnpj", formatCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                  />
                  <Button
                    type="button" variant="outline" onClick={lookupCnpj}
                    disabled={lookingUp} className="shrink-0"
                  >
                    {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Inscrição estadual</Label>
                <Input
                  value={form.state_registration}
                  onChange={(e) => update("state_registration", e.target.value)}
                  placeholder="Isenta"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entidade de cobrança (bill to)</Label>
              <Input value={form.billing_entity} onChange={(e) => update("billing_entity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Endereço fiscal</Label>
              <Textarea
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                rows={2}
                placeholder={ADDRESS_PLACEHOLDER}
              />
              <p className="text-xs text-muted-foreground">Sai assim, linha por linha, no pedido de NF ao contador.</p>
            </div>
            <div className="space-y-2">
              <Label>Endereço de cobrança (se diferente)</Label>
              <Input value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Regras do cliente para a NF</Label>
              <Textarea value={form.nf_rules} onChange={(e) => update("nf_rules", e.target.value)} rows={3} placeholder="Regras deste cliente para a emissão da NF" />
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
