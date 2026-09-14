"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { normalizeName } from "@/lib/text-case"
import { parseEmails, validateEmailList } from "@/lib/emails"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Plus, Trash2 } from "lucide-react"

export type ContactRow = {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  cc_invoices: boolean
}

/** A row being edited: `id` is absent until it has been saved once. */
type Draft = {
  id?: string
  name: string
  role: string
  email: string
  phone: string
  cc_invoices: boolean
}

const toDraft = (c: ContactRow): Draft => ({
  id: c.id, name: c.name, role: c.role ?? "", email: c.email ?? "",
  phone: c.phone ?? "", cc_invoices: c.cc_invoices,
})

const blank = (): Draft => ({ name: "", role: "", email: "", phone: "", cc_invoices: false })

export function ContactsDialog({
  clientId, clientEmail, clientPhone, contacts, children,
}: {
  clientId: string
  clientEmail: string | null
  clientPhone: string | null
  contacts: ContactRow[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Draft[]>(contacts.map(toDraft))
  const [email, setEmail] = useState(clientEmail ?? "")
  const [phone, setPhone] = useState(clientPhone ?? "")
  const [removed, setRemoved] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Reopening starts from what is on the server, not from a half-finished edit.
  function onOpenChange(next: boolean) {
    if (next) {
      setRows(contacts.map(toDraft))
      setEmail(clientEmail ?? "")
      setPhone(clientPhone ?? "")
      setRemoved([])
    }
    setOpen(next)
  }

  const update = (i: number, patch: Partial<Draft>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function remove(i: number) {
    const row = rows[i]
    if (row.id) setRemoved(ids => [...ids, row.id!])
    setRows(rs => rs.filter((_, j) => j !== i))
  }

  async function save() {
    const emailCheck = validateEmailList(email)
    if (!emailCheck.ok) { toast.error(emailCheck.error); return }

    const named = rows.filter(r => r.name.trim())
    if (named.length !== rows.length) { toast.error("Todo contato precisa de um nome"); return }
    const ccNoEmail = named.find(r => r.cc_invoices && !r.email.trim())
    if (ccNoEmail) { toast.error(`${ccNoEmail.name} está marcado para cópia mas não tem e-mail`); return }

    setSaving(true)

    // The card shows the client's own address and its people together, so one button
    // saves both — otherwise the top half of the card looks editable and is not.
    const { error: clientError } = await supabase.from("clients").update({
      email: parseEmails(email).join(", ") || null,
      phone: phone.trim() || null,
    }).eq("id", clientId)
    if (clientError) { toast.error("Erro ao salvar o e-mail do cliente"); setSaving(false); return }

    const payload = (r: Draft) => ({
      client_id: clientId,
      name: normalizeName(r.name.trim()),
      role: r.role.trim() || null,
      email: r.email.trim().toLowerCase() || null,
      phone: r.phone.trim() || null,
      cc_invoices: r.cc_invoices,
    })

    if (removed.length) {
      const { error } = await supabase.from("client_contacts").delete().in("id", removed)
      if (error) { toast.error("Erro ao remover contato"); setSaving(false); return }
    }

    const updates = named.filter(r => r.id)
    for (const r of updates) {
      const { error } = await supabase.from("client_contacts").update(payload(r)).eq("id", r.id!)
      if (error) { toast.error(`Erro ao salvar ${r.name}`); setSaving(false); return }
    }

    const inserts = named.filter(r => !r.id).map(payload)
    if (inserts.length) {
      const { error } = await supabase.from("client_contacts").insert(inserts)
      if (error) { toast.error("Erro ao criar contato"); setSaving(false); return }
    }

    toast.success("Contato salvo")
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contato do cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Dados do cliente</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@empresa.com, outro@empresa.com"
                />
                <p className="text-xs text-muted-foreground">
                  Vários separados por vírgula. O primeiro recebe a invoice.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground pt-1">Pessoas</p>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum contato ainda. Adicione quem deve receber ou acompanhar as invoices.
            </p>
          )}

          {rows.map((row, i) => (
            <div key={row.id ?? `novo-${i}`} className="rounded-md border p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={row.name} onChange={e => update(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cargo</Label>
                  <Input value={row.role} onChange={e => update(i, { role: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email" value={row.email}
                    onChange={e => update(i, { email: e.target.value })}
                    placeholder="nome@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={row.phone} onChange={e => update(i, { phone: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id={`cc-${i}`}
                    checked={row.cc_invoices}
                    onCheckedChange={v => update(i, { cc_invoices: v })}
                  />
                  <Label htmlFor={`cc-${i}`} className="text-sm font-normal">
                    Copiar nas invoices
                  </Label>
                </div>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs, blank()])}>
            <Plus className="w-4 h-4" />
            Adicionar contato
          </Button>

          <p className="text-xs text-muted-foreground">
            Quem estiver marcado entra em cópia no e-mail da invoice. O destinatário continua
            sendo o e-mail principal do cliente.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
