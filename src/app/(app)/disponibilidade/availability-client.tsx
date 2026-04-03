"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

type Status = "disponivel" | "parcialmente" | "ocupado" | "indisponivel"

interface Availability {
  status: Status
  available_from: string | null
  hours_per_week: number | null
  working_days: string[]
  message: string | null
  accepting_projects: boolean
  updated_at?: string
}

interface Props {
  availability: Availability | null
}

const STATUS_OPTIONS: {
  value: Status
  label: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}[] = [
  {
    value:       "disponivel",
    label:       "Disponível",
    description: "Aceito novos projetos",
    icon:        CheckCircle2,
    color:       "text-emerald-600",
    bg:          "bg-emerald-50 dark:bg-emerald-950/30",
    border:      "border-emerald-500",
  },
  {
    value:       "parcialmente",
    label:       "Parcialmente disponível",
    description: "Capacidade limitada",
    icon:        Clock,
    color:       "text-amber-600",
    bg:          "bg-amber-50 dark:bg-amber-950/30",
    border:      "border-amber-500",
  },
  {
    value:       "ocupado",
    label:       "Ocupado",
    description: "Sem disponibilidade no momento",
    icon:        AlertCircle,
    color:       "text-orange-600",
    bg:          "bg-orange-50 dark:bg-orange-950/30",
    border:      "border-orange-500",
  },
  {
    value:       "indisponivel",
    label:       "Indisponível",
    description: "Fora de serviço",
    icon:        XCircle,
    color:       "text-red-600",
    bg:          "bg-red-50 dark:bg-red-950/30",
    border:      "border-red-500",
  },
]

const DAYS = [
  { key: "dom", label: "Dom" },
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
]

const DEFAULT_DAYS = ["seg", "ter", "qua", "qui", "sex"]

export function AvailabilityClient({ availability }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [status, setStatus]       = useState<Status>(availability?.status ?? "disponivel")
  const [from, setFrom]           = useState(availability?.available_from ?? "")
  const [hours, setHours]         = useState(availability?.hours_per_week?.toString() ?? "")
  const [days, setDays]           = useState<string[]>(availability?.working_days ?? DEFAULT_DAYS)
  const [message, setMessage]     = useState(availability?.message ?? "")
  const [accepting, setAccepting] = useState(availability?.accepting_projects ?? true)

  function toggleDay(day: string) {
    setDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day])
  }

  async function handleSave() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      user_id:            user!.id,
      status,
      available_from:     from || null,
      hours_per_week:     hours ? parseInt(hours) : null,
      working_days:       days,
      message:            message || null,
      accepting_projects: accepting,
      updated_at:         new Date().toISOString(),
    }

    const { error } = await supabase
      .from("user_availability")
      .upsert(payload, { onConflict: "user_id" })

    if (error) {
      toast.error("Erro ao salvar disponibilidade")
      setLoading(false)
      return
    }

    toast.success("Disponibilidade atualizada!")
    router.refresh()
    setLoading(false)
  }

  const current = STATUS_OPTIONS.find(s => s.value === status)!

  return (
    <div className="p-6 max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Status de Agenda</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure sua disponibilidade para novos projetos e clientes.
        </p>
      </div>

      {/* Current status preview */}
      <div className={`rounded-xl border-2 p-5 flex items-center gap-4 ${current.bg} ${current.border}`}>
        <current.icon className={`w-10 h-10 ${current.color} shrink-0`} />
        <div className="flex-1">
          <p className={`text-lg font-bold ${current.color}`}>{current.label}</p>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
        {availability?.updated_at && (
          <p className="text-xs text-muted-foreground text-right shrink-0">
            Atualizado<br />
            {format(new Date(availability.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      {/* Status selector */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Status</Label>
        <div className="grid grid-cols-2 gap-3">
          {STATUS_OPTIONS.map(opt => {
            const active = status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={[
                  "flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all",
                  active
                    ? `${opt.bg} ${opt.border}`
                    : "border-border hover:border-muted-foreground/40 bg-card",
                ].join(" ")}
              >
                <opt.icon className={`w-5 h-5 shrink-0 ${active ? opt.color : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-sm font-semibold ${active ? opt.color : "text-foreground"}`}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="from">Disponível a partir de</Label>
          <Input id="from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <p className="text-xs text-muted-foreground">Deixe em branco se já disponível</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hours">Horas disponíveis por semana</Label>
          <div className="flex items-center gap-2">
            <Input
              id="hours"
              type="number"
              min={0}
              max={80}
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="Ex: 20"
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">h/semana</span>
          </div>
        </div>
      </div>

      {/* Working days */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Dias de trabalho</Label>
        <div className="flex gap-2">
          {DAYS.map(d => {
            const active = days.includes(d.key)
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={[
                  "w-12 h-12 rounded-lg text-sm font-medium border-2 transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-muted-foreground/50",
                ].join(" ")}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message" className="text-base font-semibold">Mensagem para clientes</Label>
        <Textarea
          id="message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ex: Disponível para projetos de design e desenvolvimento web. Preferência por projetos de médio prazo."
          rows={3}
        />
      </div>

      {/* Accepting toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium text-sm">Aceitar novos contatos</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indica que você está aberto a receber propostas
          </p>
        </div>
        <Switch checked={accepting} onCheckedChange={setAccepting} />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="min-w-32">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Salvar"}
        </Button>
      </div>
    </div>
  )
}
