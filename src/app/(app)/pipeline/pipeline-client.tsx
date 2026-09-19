"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, GripVertical } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { PageHeader } from "@/components/page-header"

interface Deal {
  id: string; user_id: string; stage: string; title: string
  value: number | null; expected_close: string | null; notes: string | null; position: number
  clients: { id: string; name: string; company: string | null } | null
  client_id: string | null
}

interface Client { id: string; name: string; company: string | null }

interface Props { deals: Deal[]; clients: Client[] }

const STAGES = [
  { key: "lead",         label: "Lead",        color: "#94a3b8" },
  { key: "contacted",    label: "Contatado",   color: "#3b82f6" },
  { key: "proposal",     label: "Proposta",    color: "#f59e0b" },
  { key: "negotiation",  label: "Negociação",  color: "#a855f7" },
  { key: "won",          label: "Fechado",     color: "#22c55e" },
  { key: "lost",         label: "Perdido",     color: "#ef4444" },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]))

function DealDialog({
  deal, clients, open, onClose,
}: { deal?: Deal; clients: Client[]; open: boolean; onClose: () => void }) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title:          deal?.title          ?? "",
    client_id:      deal?.client_id      ?? "none",
    stage:          deal?.stage          ?? "lead",
    value:          deal?.value          ?? "",
    expected_close: deal?.expected_close ?? "",
    notes:          deal?.notes          ?? "",
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("Título obrigatório"); return }
    setLoading(true)

    const payload = {
      title:          form.title,
      client_id:      form.client_id === "none" ? null : form.client_id,
      stage:          form.stage,
      value:          form.value ? Number(form.value) : null,
      expected_close: form.expected_close || null,
      notes:          form.notes || null,
    }

    if (deal) {
      const { error } = await supabase.from("sales_pipeline").update(payload).eq("id", deal.id)
      if (error) { toast.error("Erro ao atualizar"); setLoading(false); return }
      toast.success("Deal atualizado!")
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("sales_pipeline").insert({ ...payload, user_id: user!.id })
      if (error) { toast.error("Erro ao criar"); setLoading(false); return }
      toast.success("Deal criado!")
    }

    setLoading(false)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{deal ? "Editar deal" : "Novo deal"}</DialogTitle>
          <DialogDescription className="sr-only">Gerenciar oportunidade no pipeline de vendas</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} required
              placeholder="Ex: Proposta de redesign" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estágio</Label>
              <Select value={form.stage} onValueChange={v => set("stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Combobox
                options={[{ value: "none", label: "Nenhum" }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={form.client_id || "none"}
                onChange={v => set("client_id", v)}
                placeholder="Nenhum"
                searchPlaceholder="Buscar cliente…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor estimado (R$)</Label>
              <Input type="number" step="0.01" min="0"
                value={form.value} onChange={e => set("value", e.target.value)}
                placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Fechamento previsto</Label>
              <Input type="date" value={form.expected_close} onChange={e => set("expected_close", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
              placeholder="Contexto, próximos passos..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {deal ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PipelineClient({ deals: initialDeals, clients }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [deals, setDeals] = useState(initialDeals)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing]       = useState<Deal | undefined>()
  const dragItem = useRef<string | null>(null) // deal id being dragged
  const dragOver = useRef<string | null>(null) // target stage

  async function handleDelete(id: string) {
    if (!confirm("Excluir este deal?")) return
    const { error } = await supabase.from("sales_pipeline").delete().eq("id", id)
    if (error) { toast.error("Erro ao excluir"); return }
    setDeals(d => d.filter(x => x.id !== id))
    toast.success("Deal excluído")
  }

  async function moveToStage(dealId: string, newStage: string) {
    const prev = [...deals]
    setDeals(d => d.map(x => x.id === dealId ? { ...x, stage: newStage } : x))
    const { error } = await supabase.from("sales_pipeline").update({ stage: newStage }).eq("id", dealId)
    if (error) { setDeals(prev); toast.error("Erro ao mover deal") }
  }

  function onDragStart(dealId: string) { dragItem.current = dealId }
  function onDragOver(e: React.DragEvent, stage: string) { e.preventDefault(); dragOver.current = stage }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    if (dragItem.current && dragOver.current) {
      moveToStage(dragItem.current, dragOver.current)
    }
    dragItem.current = null
    dragOver.current = null
  }

  const totalByStage: Record<string, number> = {}
  deals.forEach(d => {
    totalByStage[d.stage] = (totalByStage[d.stage] ?? 0) + (d.value ?? 0)
  })

  const wonTotal = totalByStage["won"] ?? 0
  const pipelineTotal = deals.filter(d => !["won","lost"].includes(d.stage)).reduce((s, d) => s + (d.value ?? 0), 0)

  return (
    <div className="px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Comunicação"
        title="Pipeline de Vendas"
        description={
          <>
            {deals.filter(d => !["won","lost"].includes(d.stage)).length} oportunidades em aberto · {formatCurrency(pipelineTotal)} no pipeline
          </>
        }
        actions={
          <>
            {wonTotal > 0 && (
              <span className="text-sm font-medium text-green-600">
                Fechado: {formatCurrency(wonTotal)}
              </span>
            )}
            <Button className="gap-2" onClick={() => { setEditing(undefined); setDialogOpen(true) }}>
              <Plus className="w-4 h-4" /> Novo deal
            </Button>
          </>
        }
      />

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key)
          const stageTotal = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-64 flex flex-col"
              onDragOver={e => onDragOver(e, stage.key)}
              onDrop={onDrop}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5">
                    {stageDeals.length}
                  </span>
                </div>
                {stageTotal > 0 && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(stageTotal)}</span>
                )}
              </div>

              {/* Drop zone */}
              <div className="flex flex-col gap-2 min-h-24 rounded-xl bg-muted/30 p-2">
                {stageDeals.map(deal => {
                  const client = deal.clients as unknown as { name: string; company: string | null } | null
                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => onDragStart(deal.id)}
                      className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug">{deal.title}</p>
                            {client && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            className="p-1 hover:bg-accent rounded"
                            onClick={() => { setEditing(deal); setDialogOpen(true) }}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button
                            className="p-1 hover:bg-destructive/10 rounded"
                            onClick={() => handleDelete(deal.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      </div>

                      {deal.value && (
                        <p className="text-xs font-semibold mt-2" style={{ color: stage.color }}>
                          {formatCurrency(deal.value)}
                        </p>
                      )}
                      {deal.expected_close && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Prev: {format(new Date(deal.expected_close + "T12:00"), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                  )
                })}

                {stageDeals.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <p className="text-xs text-muted-foreground">Arraste aqui</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <DealDialog
        deal={editing}
        clients={clients}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined) }}
      />
    </div>
  )
}
