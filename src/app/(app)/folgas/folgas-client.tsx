"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek,
  endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, CalendarOff, Loader2, Trash2 } from "lucide-react"

interface TimeOff {
  id: string; user_id: string; date: string; type: string; note: string | null
}

interface Props {
  timeOff: TimeOff[]
  yearTimeOff: { date: string; type: string }[]
  currentMonth: string
}

const TYPES: { value: string; label: string; emoji: string; color: string }[] = [
  { value: "ferias",   label: "Férias",   emoji: "🏖️", color: "#3b82f6" },
  { value: "feriado",  label: "Feriado",  emoji: "🎉", color: "#8b5cf6" },
  { value: "folga",    label: "Folga",    emoji: "😴", color: "#10b981" },
  { value: "doenca",   label: "Doença",   emoji: "🤒", color: "#f59e0b" },
  { value: "outro",    label: "Outro",    emoji: "📌", color: "#64748b" },
]
const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t]))
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

async function syncAvailabilityForDate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  date: string,
) {
  const today = format(new Date(), "yyyy-MM-dd")
  if (date !== today) return

  const { count } = await supabase
    .from("time_off")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", today)

  const hasTimeOffToday = (count ?? 0) > 0
  const newStatus = hasTimeOffToday ? "indisponivel" as const : "disponivel" as const

  const { error } = await supabase
    .from("user_availability")
    .upsert(
      { user_id: userId, status: newStatus },
      { onConflict: "user_id" },
    )
  if (error) console.error("Failed to sync availability:", error.message)
}

export function FolgasClient({ timeOff, yearTimeOff, currentMonth }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth   = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth   = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel  = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [form, setForm]                 = useState({ type: "folga", note: "" })

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
    const days: Date[] = []
    let cur = start
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }
    return days
  }, [currentMonth])

  const timeOffMap = useMemo(() => {
    const m: Record<string, TimeOff> = {}
    timeOff.forEach(t => { m[t.date] = t })
    return m
  }, [timeOff])

  function openDay(dateStr: string) {
    setSelectedDate(dateStr)
    const existing = timeOffMap[dateStr]
    setForm({ type: existing?.type ?? "folga", note: existing?.note ?? "" })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!selectedDate) return
    setLoading(true)

    const existing = timeOffMap[selectedDate]
    if (existing) {
      const { error } = await supabase.from("time_off")
        .update({ type: form.type, note: form.note || null })
        .eq("id", existing.id)
      if (error) { toast.error("Erro ao atualizar"); setLoading(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from("time_off").insert({
        user_id: user!.id, date: selectedDate, type: form.type, note: form.note || null,
      })
      if (error) { toast.error("Erro ao salvar"); setLoading(false); return }
      await syncAvailabilityForDate(supabase, user!.id, selectedDate)
    }

    toast.success("Dia registrado!")
    setDialogOpen(false)
    router.refresh()
    setLoading(false)
  }

  async function handleDelete() {
    if (!selectedDate) return
    const existing = timeOffMap[selectedDate]
    if (!existing) { setDialogOpen(false); return }
    const { error } = await supabase.from("time_off").delete().eq("id", existing.id)
    if (error) { toast.error("Erro ao excluir"); return }
    await syncAvailabilityForDate(supabase, existing.user_id, selectedDate)
    toast.success("Dia removido")
    setDialogOpen(false)
    router.refresh()
  }

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    timeOff.forEach(t => { c[t.type] = (c[t.type] ?? 0) + 1 })
    return c
  }, [timeOff])

  // Year dots for quick overview
  const yearMap = useMemo(() => {
    const m: Record<string, string> = {}
    yearTimeOff.forEach(t => { m[t.date] = t.type })
    return m
  }, [yearTimeOff])

  const totalDaysOff = yearTimeOff.length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Folgas e Férias</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {totalDaysOff} dia{totalDaysOff !== 1 ? "s" : ""} registrado{totalDaysOff !== 1 ? "s" : ""} este ano
          </p>
        </div>
        <div className="flex items-center border rounded-lg h-9">
          <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/folgas?month=${prevMonth}`)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3 capitalize min-w-36 text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/folgas?month=${nextMonth}`)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map(t => (
          counts[t.value] ? (
            <span key={t.value} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border"
              style={{ borderColor: t.color + "40", background: t.color + "15", color: t.color }}>
              {t.emoji} {t.label}: <strong>{counts[t.value]}</strong>
            </span>
          ) : null
        ))}
        {Object.keys(counts).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum dia registrado neste mês. Clique em um dia para adicionar.</p>
        )}
      </div>

      {/* Calendar */}
      <div className="border rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2.5">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const inMonth = isSameMonth(day, currentDate)
            const today   = isToday(day)
            const off     = timeOffMap[dateStr]
            const t       = off ? TYPE_MAP[off.type] : null

            return (
              <button
                key={i}
                disabled={!inMonth}
                onClick={() => inMonth && openDay(dateStr)}
                className={[
                  "min-h-16 p-2 border-b border-r text-left transition-colors",
                  !inMonth ? "opacity-30 bg-muted/10 cursor-default" : "hover:bg-accent cursor-pointer",
                  today ? "bg-blue-50/50 dark:bg-blue-950/20" : "",
                  off && inMonth ? "ring-1 ring-inset" : "",
                ].join(" ")}
                style={off && inMonth ? { "--ring-color": t?.color } as React.CSSProperties : undefined}
              >
                <div className={[
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  today ? "bg-blue-600 text-white" : "text-foreground",
                ].join(" ")}>
                  {format(day, "d")}
                </div>
                {off && inMonth && t && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-sm leading-none">{t.emoji}</span>
                    <span className="text-xs leading-tight" style={{ color: t.color }}>{t.label}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List of entries */}
      {timeOff.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Dias registrados ({timeOff.length})
          </h2>
          {timeOff.map(entry => {
            const t = TYPE_MAP[entry.type]
            return (
              <div key={entry.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
                <span className="text-lg">{t?.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{format(parseISO(entry.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                  <p className="text-xs font-medium" style={{ color: t?.color }}>{t?.label}</p>
                  {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    const { error } = await supabase.from("time_off").delete().eq("id", entry.id)
                    if (error) { toast.error("Erro ao excluir"); return }
                    await syncAvailabilityForDate(supabase, entry.user_id, entry.date)
                    toast.success("Removido")
                    router.refresh()
                  }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty */}
      {timeOff.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <CalendarOff className="w-10 h-10 opacity-30 mb-3" />
          <p className="font-medium">Nenhum dia registrado neste mês</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR }) : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">Registrar folga ou férias</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    className={[
                      "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-xs font-medium",
                      form.type === t.value ? "border-current" : "border-transparent hover:border-muted",
                    ].join(" ")}
                    style={{ color: form.type === t.value ? t.color : undefined }}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Input
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ex: Viagem de negócios, feriado municipal..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {timeOffMap[selectedDate!] && (
              <Button variant="ghost" size="sm" className="text-destructive mr-auto" onClick={handleDelete}>
                Remover
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
