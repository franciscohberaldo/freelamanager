"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Loader2, BookOpen, X } from "lucide-react"
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isToday, addMonths, subMonths
} from "date-fns"
import { ptBR } from "date-fns/locale"

interface Entry {
  id: string; date: string; content: string | null
  mood: string | null; highlights: string[]
}
interface Props { entries: Entry[]; currentMonth: string }

const MOODS = [
  { key: "great",    emoji: "😄", label: "Ótimo",   color: "#22c55e" },
  { key: "good",     emoji: "🙂", label: "Bom",     color: "#84cc16" },
  { key: "okay",     emoji: "😐", label: "Ok",      color: "#f59e0b" },
  { key: "bad",      emoji: "😕", label: "Ruim",    color: "#f97316" },
  { key: "terrible", emoji: "😞", label: "Péssimo", color: "#ef4444" },
]
const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.key, m]))

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function JournalClient({ entries, currentMonth }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const currentDate = parseISO(currentMonth + "-01")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [content, setContent]           = useState("")
  const [mood, setMood]                 = useState<string>("")
  const [loading, setLoading]           = useState(false)
  const [dialogOpen, setDialogOpen]     = useState(false)

  // Build calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
    const days: Date[] = []
    let cur = start
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }
    return days
  }, [currentMonth])

  const entryMap = useMemo(() => {
    const m: Record<string, Entry> = {}
    entries.forEach(e => { m[e.date] = e })
    return m
  }, [entries])

  function navigate(month: string) { router.push(`/diario?month=${month}`) }
  const prevMonth = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth = format(addMonths(currentDate, 1), "yyyy-MM")

  function openDay(dateStr: string) {
    const existing = entryMap[dateStr]
    setSelectedDate(dateStr)
    setContent(existing?.content ?? "")
    setMood(existing?.mood ?? "")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!selectedDate) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const existing = entryMap[selectedDate]
    const payload  = {
      user_id:    user!.id,
      date:       selectedDate,
      content:    content.trim() || null,
      mood:       mood || null,
      highlights: [],
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await supabase.from("daily_journal").update(payload).eq("id", existing.id)
      if (error) { toast.error("Erro ao salvar"); setLoading(false); return }
    } else {
      const { error } = await supabase.from("daily_journal").insert(payload)
      if (error) { toast.error("Erro ao salvar"); setLoading(false); return }
    }

    toast.success("Anotação salva!")
    setDialogOpen(false)
    router.refresh()
    setLoading(false)
  }

  async function handleDelete() {
    if (!selectedDate) return
    const existing = entryMap[selectedDate]
    if (!existing) { setDialogOpen(false); return }
    const { error } = await supabase.from("daily_journal").delete().eq("id", existing.id)
    if (error) { toast.error("Erro ao excluir"); return }
    toast.success("Anotação excluída")
    setDialogOpen(false)
    router.refresh()
  }

  const selectedEntry = selectedDate ? entryMap[selectedDate] : null
  const monthLabel    = format(currentDate, "MMMM yyyy", { locale: ptBR })

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diário</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registre o que você fez a cada dia</p>
        </div>
        <div className="flex items-center gap-1 border rounded-lg">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(prevMonth)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2 capitalize min-w-36 text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(nextMonth)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
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
            const dateStr  = format(day, "yyyy-MM-dd")
            const inMonth  = isSameMonth(day, currentDate)
            const today    = isToday(day)
            const entry    = entryMap[dateStr]
            const moodInfo = entry?.mood ? MOOD_MAP[entry.mood] : null
            const isFuture = day > new Date()

            return (
              <button
                key={i}
                disabled={!inMonth || isFuture}
                onClick={() => openDay(dateStr)}
                className={[
                  "min-h-20 p-2 border-b border-r text-left transition-colors",
                  !inMonth ? "opacity-30 bg-muted/10 cursor-default" : "",
                  isFuture && inMonth ? "opacity-40 cursor-default" : "",
                  inMonth && !isFuture ? "hover:bg-accent cursor-pointer" : "",
                  today ? "bg-blue-50/50 dark:bg-blue-950/20" : "",
                  entry && inMonth ? "ring-1 ring-inset ring-primary/20" : "",
                ].join(" ")}
              >
                {/* Day number */}
                <div className={[
                  "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  today ? "bg-blue-600 text-white" : "text-foreground",
                ].join(" ")}>
                  {format(day, "d")}
                </div>

                {/* Entry preview */}
                {entry && inMonth && (
                  <div className="space-y-1">
                    {moodInfo && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm leading-none">{moodInfo.emoji}</span>
                        <span className="text-xs text-muted-foreground">{moodInfo.label}</span>
                      </div>
                    )}
                    {entry.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                        {entry.content}
                      </p>
                    )}
                  </div>
                )}

                {/* Empty day dot */}
                {!entry && inMonth && !isFuture && (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 mt-1" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent entries list */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Entradas do mês ({entries.length})
          </h2>
          <div className="space-y-2">
            {entries.slice(0, 10).map(e => {
              const moodInfo = e.mood ? MOOD_MAP[e.mood] : null
              return (
                <button key={e.id} onClick={() => openDay(e.date)}
                  className="w-full text-left rounded-lg border bg-card px-4 py-3 hover:shadow-sm transition-shadow flex gap-4 items-start">
                  <div className="shrink-0 text-center">
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(e.date), "EEE", { locale: ptBR })}
                    </p>
                    <p className="text-lg font-bold leading-none">
                      {format(parseISO(e.date), "dd")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(e.date), "MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    {moodInfo && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{moodInfo.emoji}</span>
                        <span className="text-xs font-medium" style={{ color: moodInfo.color }}>{moodInfo.label}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {e.content ?? "Sem anotações"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 opacity-30 mb-3" />
          <p className="font-medium">Nenhuma entrada neste mês</p>
          <p className="text-sm mt-1">Clique em qualquer dia do calendário para escrever</p>
        </div>
      )}

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(parseISO(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR }) : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">Registrar o que fez neste dia</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mood */}
            <div>
              <p className="text-sm font-medium mb-2">Como foi o dia?</p>
              <div className="flex gap-2">
                {MOODS.map(m => (
                  <button key={m.key} type="button"
                    onClick={() => setMood(mood === m.key ? "" : m.key)}
                    className={[
                      "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border-2 transition-all flex-1",
                      mood === m.key ? "border-current bg-accent" : "border-transparent hover:border-muted",
                    ].join(" ")}
                    style={{ color: mood === m.key ? m.color : undefined }}
                    title={m.label}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div>
              <p className="text-sm font-medium mb-2">O que você fez hoje?</p>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Escreva sobre reuniões, entregas, aprendizados, dificuldades..."
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {selectedEntry && (
              <Button variant="ghost" size="sm" className="text-destructive mr-auto"
                onClick={handleDelete}>
                Excluir
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
