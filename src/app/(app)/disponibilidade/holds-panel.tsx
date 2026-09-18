"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash2, CalendarRange } from "lucide-react"
import { format, parseISO, differenceInCalendarDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { AvailabilityHold } from "@/lib/supabase/types"

export type HoldType = AvailabilityHold["type"]

export const HOLD_TYPES: Record<HoldType, { label: string; color: string; badge: string }> = {
  "1st_hold": { label: "1st Hold", color: "#f59e0b", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  "2nd_hold": { label: "2nd Hold", color: "#94a3b8", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  "booked":   { label: "Booked",   color: "#3b82f6", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
}

export type HoldWithRefs = AvailabilityHold & {
  clients: { name: string } | null
  jobs: { name: string } | null
}

interface Props {
  holds: HoldWithRefs[]
  clients: { id: string; name: string }[]
  jobs: { id: string; name: string; client_id: string }[]
}

export function HoldsPanel({ holds, clients, jobs }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    client_id: "", job_id: "", type: "1st_hold" as HoldType,
    start_date: "", end_date: "", note: "",
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const jobsForClient = form.client_id ? jobs.filter(j => j.client_id === form.client_id) : jobs

  async function addHold(e: React.FormEvent) {
    e.preventDefault()
    if (!form.start_date || !form.end_date) { toast.error("Informe início e fim"); return }
    if (form.end_date < form.start_date) { toast.error("Fim antes do início"); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("availability_holds").insert({
      user_id:    user!.id,
      client_id:  form.client_id || null,
      job_id:     form.job_id || null,
      type:       form.type,
      start_date: form.start_date,
      end_date:   form.end_date,
      note:       form.note.trim() || null,
    })
    if (error) { toast.error("Erro ao salvar hold"); setLoading(false); return }
    toast.success("Hold registrado")
    setForm({ client_id: "", job_id: "", type: "1st_hold", start_date: "", end_date: "", note: "" })
    router.refresh()
    setLoading(false)
  }

  async function removeHold(id: string) {
    const { error } = await supabase.from("availability_holds").delete().eq("id", id)
    if (error) { toast.error("Erro ao remover"); return }
    toast.success("Hold removido")
    router.refresh()
  }

  const today = format(new Date(), "yyyy-MM-dd")
  const sorted = [...holds].sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
            <CalendarRange className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">Holds de clientes</CardTitle>
            <CardDescription>Períodos reservados por clientes (1st hold, 2nd hold, booked). Aparecem no calendário da agenda.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum hold registrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {sorted.map(h => {
              const t = HOLD_TYPES[h.type]
              const days = differenceInCalendarDays(parseISO(h.end_date), parseISO(h.start_date)) + 1
              const past = h.end_date < today
              return (
                <li key={h.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${past ? "opacity-60" : ""}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{h.clients?.name ?? "Sem cliente"}</span>
                      <Badge className={`${t.badge} border-0`}>{t.label}</Badge>
                      {h.jobs?.name && <span className="text-xs text-muted-foreground truncate">· {h.jobs.name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(h.start_date), "dd MMM", { locale: ptBR })} – {format(parseISO(h.end_date), "dd MMM yyyy", { locale: ptBR })} · {days} {days === 1 ? "dia" : "dias"}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeHold(h.id)} title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={addHold} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Combobox
              options={[{ value: "none", label: "Sem cliente" }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
              value={form.client_id || "none"}
              onChange={v => { set("client_id", v === "none" ? "" : v); set("job_id", "") }}
              placeholder="Selecionar"
              searchPlaceholder="Buscar cliente…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Job (opcional)</Label>
            <Combobox
              options={[{ value: "none", label: "Nenhum" }, ...jobsForClient.map(j => ({ value: j.id, label: j.name }))]}
              value={form.job_id || "none"}
              onChange={v => set("job_id", v === "none" ? "" : v)}
              placeholder="Nenhum"
              searchPlaceholder="Buscar job…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.type} onValueChange={v => set("type", v as HoldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(HOLD_TYPES) as HoldType[]).map(k => <SelectItem key={k} value={k}>{HOLD_TYPES[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observação</Label>
            <Input value={form.note} onChange={e => set("note", e.target.value)} placeholder="ex: confirmar até 30/09" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => set("end_date", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar hold
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
