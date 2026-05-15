"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  format, parseISO, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, isSameMonth, startOfWeek, endOfWeek,
  isSameWeek, addWeeks, subWeeks,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatHours, cn } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  ChevronLeft, ChevronRight, Plus, Download,
  Clock, DollarSign, Briefcase, X, Loader2,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  currency: string
  clients: { name: string } | null
}

interface LogEntry {
  id: string
  date: string
  hours_worked: number
  hours_billed: number
  total_value: number
  job_id: string
  jobs: { id: string; name: string; clients: { name: string } | null } | null
}

interface Props {
  logs: LogEntry[]
  jobs: JobOption[]
  currentMonth: string
}

// ─── Job color palette ───────────────────────────────────────────────────────

const JOB_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
]

function getJobColor(jobId: string, allJobIds: string[]) {
  const idx = allJobIds.indexOf(jobId)
  return JOB_COLORS[idx % JOB_COLORS.length]
}

// ─── Quick-add form (inline in day cell click or modal) ──────────────────────

interface QuickAddProps {
  date: string
  jobs: JobOption[]
  onSaved: () => void
  onCancel: () => void
}

function QuickAddForm({ date, jobs, onSaved, onCancel }: QuickAddProps) {
  const supabase = createClient()
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "")
  const [hoursWorked, setHoursWorked] = useState("8")
  const [hoursBilled, setHoursBilled] = useState("8")
  const [meetings, setMeetings] = useState("")
  const [requests, setRequests] = useState("")
  const [loading, setLoading] = useState(false)

  const selectedJob = jobs.find(j => j.id === jobId)
  const total = (parseFloat(hoursBilled) || 0) * (selectedJob?.hourly_rate ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) { toast.error("Selecione um job"); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("daily_logs").insert({
      user_id: user!.id,
      job_id: jobId,
      date,
      hours_worked: parseFloat(hoursWorked) || 0,
      hours_billed: parseFloat(hoursBilled) || 0,
      daily_rate: 0,
      total_value: total,
      meetings: meetings || null,
      requests: requests || null,
    })
    if (error) { toast.error("Erro ao criar registro"); setLoading(false); return }
    toast.success("Registro criado!")
    setLoading(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Job *</Label>
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Selecione o job" />
          </SelectTrigger>
          <SelectContent>
            {jobs.map(j => (
              <SelectItem key={j.id} value={j.id} className="text-sm">
                {j.name}{j.clients ? ` · ${(j.clients as { name: string }).name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Horas trabalhadas</Label>
          <Input className="h-8 text-sm" type="number" step="0.25" value={hoursWorked}
            onChange={e => setHoursWorked(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Horas faturadas</Label>
          <Input className="h-8 text-sm" type="number" step="0.25" value={hoursBilled}
            onChange={e => setHoursBilled(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Reuniões</Label>
        <Textarea className="text-sm resize-none" rows={2} placeholder="O que foi discutido..."
          value={meetings} onChange={e => setMeetings(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Pedidos</Label>
        <Textarea className="text-sm resize-none" rows={2} placeholder="Tarefas solicitadas..."
          value={requests} onChange={e => setRequests(e.target.value)} />
      </div>
      {selectedJob && (
        <p className="text-xs text-muted-foreground">
          Total: <span className="font-semibold text-foreground">
            {formatCurrency(total, selectedJob.currency)}
          </span>
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  )
}

// ─── Timeline bar for a single day ───────────────────────────────────────────

function DayTimeline({
  dayLogs,
  jobColors,
}: {
  dayLogs: LogEntry[]
  jobColors: Record<string, string>
}) {
  if (!dayLogs.length) return null
  const totalHours = dayLogs.reduce((s, l) => s + l.hours_worked, 0)
  if (totalHours === 0) return null

  return (
    <div className="flex h-2 rounded overflow-hidden gap-px mt-1">
      {dayLogs.map(log => (
        <div
          key={log.id}
          style={{
            width: `${(log.hours_worked / totalHours) * 100}%`,
            backgroundColor: jobColors[log.job_id] ?? "#6366f1",
          }}
          title={`${(log.jobs as LogEntry["jobs"])?.name ?? "?"}: ${formatHours(log.hours_worked)}`}
        />
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TrackingClient({ logs: initialLogs, jobs, currentMonth }: Props) {
  const router = useRouter()

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth   = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth   = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel  = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterJobId, setFilterJobId] = useState<string>("all")

  const filteredLogs = useMemo(() => {
    if (filterJobId === "all") return initialLogs
    return initialLogs.filter(l => l.job_id === filterJobId)
  }, [initialLogs, filterJobId])

  // ── Job colors map ─────────────────────────────────────────────────────────
  const allJobIds = useMemo(() => Array.from(new Set(initialLogs.map(l => l.job_id))), [initialLogs])
  const jobColors = useMemo(
    () => Object.fromEntries(allJobIds.map(id => [id, getJobColor(id, allJobIds)])),
    [allJobIds]
  )

  // ── Logs by date ───────────────────────────────────────────────────────────
  const logsByDate = useMemo(() => {
    const map: Record<string, LogEntry[]> = {}
    filteredLogs.forEach(log => {
      if (!map[log.date]) map[log.date] = []
      map[log.date].push(log)
    })
    return map
  }, [filteredLogs])

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  // Build grid starting Monday
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const allDays   = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const today  = new Date()
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0)
  const expandedWeekRef = useMemo(() => addWeeks(startOfWeek(today, { weekStartsOn: 1 }), selectedWeekOffset), [today, selectedWeekOffset])

  // ── Selected day modal ─────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [addingDay, setAddingDay]     = useState<string | null>(null)

  function openDay(dateStr: string) {
    const dayLogs = logsByDate[dateStr]
    if (dayLogs?.length) {
      setSelectedDay(dateStr)
    } else {
      setAddingDay(dateStr)
    }
  }

  // ── Month totals ───────────────────────────────────────────────────────────
  const monthTotals = useMemo(() => ({
    hours: filteredLogs.reduce((s, l) => s + l.hours_worked, 0),
    value: filteredLogs.reduce((s, l) => s + l.total_value, 0),
    days:  new Set(filteredLogs.map(l => l.date)).size,
  }), [filteredLogs])

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportMonth() {
    const rows = filteredLogs.map(l => ({
      data:             l.date,
      job:              (l.jobs as LogEntry["jobs"])?.name ?? "",
      cliente:          (l.jobs as LogEntry["jobs"])?.clients?.name ?? "",
      horas_trabalhadas: l.hours_worked,
      horas_faturadas:  l.hours_billed,
      total:            l.total_value,
    }))
    downloadCsv(rows, `diario-${currentMonth}.csv`, [
      { key: "data",              label: "Data" },
      { key: "job",               label: "Job" },
      { key: "cliente",           label: "Cliente" },
      { key: "horas_trabalhadas", label: "Horas Trabalhadas" },
      { key: "horas_faturadas",   label: "Horas Faturadas" },
      { key: "total",             label: "Total" },
    ])
  }

  function exportWeek() {
    const weekStart = format(expandedWeekRef, "yyyy-MM-dd")
    const weekEnd   = format(endOfWeek(expandedWeekRef, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const rows = filteredLogs
      .filter(l => l.date >= weekStart && l.date <= weekEnd)
      .map(l => ({
        data:             l.date,
        job:              (l.jobs as LogEntry["jobs"])?.name ?? "",
        cliente:          (l.jobs as LogEntry["jobs"])?.clients?.name ?? "",
        horas_trabalhadas: l.hours_worked,
        horas_faturadas:  l.hours_billed,
        total:            l.total_value,
      }))
    downloadCsv(rows, `diario-semana-${weekStart}.csv`, [
      { key: "data",              label: "Data" },
      { key: "job",               label: "Job" },
      { key: "cliente",           label: "Cliente" },
      { key: "horas_trabalhadas", label: "Horas Trabalhadas" },
      { key: "horas_faturadas",   label: "Horas Faturadas" },
      { key: "total",             label: "Total" },
    ])
  }

  const weekDayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold capitalize">{monthLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {monthTotals.days} dias trabalhados · {formatHours(monthTotals.hours)} · {formatCurrency(monthTotals.value)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Job filter */}
          <Select value={filterJobId} onValueChange={setFilterJobId}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Todos os jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os jobs</SelectItem>
              {jobs.map(j => (
                <SelectItem key={j.id} value={j.id} className="text-sm">
                  {j.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export */}
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportWeek}>
            <Download className="w-3.5 h-3.5" />Semana
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportMonth}>
            <Download className="w-3.5 h-3.5" />Mês
          </Button>

          {/* Month nav */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => router.push(`/diario?month=${prevMonth}`)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => router.push(`/diario?month=${nextMonth}`)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week navigation (feature 5: current week expanded) */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => setSelectedWeekOffset(o => o - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Semana de {format(expandedWeekRef, "dd 'de' MMM", { locale: ptBR })} a{" "}
          {format(endOfWeek(expandedWeekRef, { weekStartsOn: 1 }), "dd 'de' MMM", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => setSelectedWeekOffset(o => o + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        {selectedWeekOffset !== 0 && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setSelectedWeekOffset(0)}
          >
            Hoje
          </button>
        )}
      </div>

      {/* Job legend */}
      {allJobIds.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {jobs.filter(j => allJobIds.includes(j.id)).map(j => (
            <button
              key={j.id}
              onClick={() => setFilterJobId(filterJobId === j.id ? "all" : j.id)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors",
                filterJobId === j.id
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
              style={filterJobId === j.id ? { backgroundColor: jobColors[j.id] } : {}}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: jobColors[j.id] }}
              />
              {j.name}
              {j.clients && <span className="opacity-70">· {(j.clients as { name: string }).name}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {weekDayNames.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {allDays.map((day, idx) => {
            const dateStr   = format(day, "yyyy-MM-dd")
            const dayLogs   = logsByDate[dateStr] ?? []
            const inMonth   = isSameMonth(day, currentDate)
            const todayFlag = isToday(day)
            const inExpandedWeek = isSameWeek(day, expandedWeekRef, { weekStartsOn: 1 })
            const totalHours = dayLogs.reduce((s, l) => s + l.hours_worked, 0)

            return (
              <div
                key={dateStr}
                onClick={() => openDay(dateStr)}
                className={cn(
                  "min-h-[80px] p-2 border-b border-r cursor-pointer transition-colors select-none",
                  !inMonth && "bg-muted/30 opacity-50",
                  todayFlag && "bg-primary/5",
                  inExpandedWeek && "bg-accent/30",
                  "hover:bg-accent/50",
                  // right + bottom borders: last col no right border, last row no bottom border
                  (idx + 1) % 7 === 0 && "border-r-0",
                  idx >= allDays.length - 7 && "border-b-0",
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      todayFlag
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {inMonth && (
                    <button
                      onClick={e => { e.stopPropagation(); setAddingDay(dateStr) }}
                      className="opacity-0 group-hover:opacity-100 hover:!opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all"
                      title="Adicionar registro"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Hours summary */}
                {totalHours > 0 && (
                  <p className="text-[10px] font-semibold text-foreground/80 mb-0.5">
                    {formatHours(totalHours)}
                  </p>
                )}

                {/* Job dots (feature 1) */}
                {dayLogs.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mb-1">
                    {dayLogs.map(log => (
                      <span
                        key={log.id}
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: jobColors[log.job_id] ?? "#6366f1" }}
                        title={(log.jobs as LogEntry["jobs"])?.name ?? ""}
                      />
                    ))}
                  </div>
                )}

                {/* Timeline bar (feature 3) */}
                {inExpandedWeek && <DayTimeline dayLogs={dayLogs} jobColors={jobColors} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded week detail strip (feature 5) */}
      {(() => {
        const weekStart = startOfWeek(expandedWeekRef, { weekStartsOn: 1 })
        const weekEnd   = endOfWeek(expandedWeekRef, { weekStartsOn: 1 })
        const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })
        const weekLogs  = filteredLogs.filter(l => l.date >= format(weekStart, "yyyy-MM-dd") && l.date <= format(weekEnd, "yyyy-MM-dd"))
        if (!weekLogs.length) return null

        const weekHours = weekLogs.reduce((s, l) => s + l.hours_worked, 0)
        const weekValue = weekLogs.reduce((s, l) => s + l.total_value, 0)

        return (
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-accent/40 border-b">
              <span className="text-sm font-semibold">Detalhes da semana</span>
              <span className="text-xs text-muted-foreground">
                {formatHours(weekHours)} · {formatCurrency(weekValue)}
              </span>
            </div>
            <div className="grid grid-cols-7 divide-x">
              {weekDays.map(day => {
                const dateStr = format(day, "yyyy-MM-dd")
                const dayLogs = logsByDate[dateStr] ?? []
                const total   = dayLogs.reduce((s, l) => s + l.hours_worked, 0)
                return (
                  <div key={dateStr} className="p-2 min-h-[60px]">
                    <p className={cn(
                      "text-[10px] font-medium mb-1",
                      isToday(day) ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(day, "EEE d", { locale: ptBR })}
                    </p>
                    {dayLogs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/50 italic">—</p>
                    ) : (
                      <>
                        <p className="text-xs font-bold">{formatHours(total)}</p>
                        {dayLogs.map(log => (
                          <div key={log.id} className="flex items-center gap-1 mt-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: jobColors[log.job_id] }}
                            />
                            <span className="text-[10px] truncate text-muted-foreground">
                              {(log.jobs as LogEntry["jobs"])?.name ?? "?"}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Day detail modal (feature 2) */}
      <Dialog open={!!selectedDay} onOpenChange={open => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(parseISO(selectedDay), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes dos registros do dia</DialogDescription>
          </DialogHeader>

          {selectedDay && (() => {
            const dayLogs = logsByDate[selectedDay] ?? []
            const totalH  = dayLogs.reduce((s, l) => s + l.hours_worked, 0)
            const totalV  = dayLogs.reduce((s, l) => s + l.total_value, 0)

            return (
              <div className="space-y-4">
                {/* Summary row */}
                <div className="flex gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{formatHours(totalH)}</span>
                    <span className="text-muted-foreground">trabalhadas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{formatCurrency(totalV)}</span>
                  </div>
                </div>

                {/* Horizontal timeline (feature 3) */}
                {totalH > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Distribuição de horas</p>
                    <div className="flex h-5 rounded overflow-hidden gap-px">
                      {dayLogs.map(log => {
                        const pct = (log.hours_worked / totalH) * 100
                        const job = log.jobs as LogEntry["jobs"]
                        return (
                          <div
                            key={log.id}
                            className="flex items-center justify-center text-[9px] font-bold text-white overflow-hidden"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: jobColors[log.job_id],
                            }}
                            title={`${job?.name}: ${formatHours(log.hours_worked)}`}
                          >
                            {pct > 10 ? `${Math.round(pct)}%` : ""}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {dayLogs.map(log => {
                        const job = log.jobs as LogEntry["jobs"]
                        return (
                          <div key={log.id} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: jobColors[log.job_id] }} />
                            <span className="font-medium">{job?.name}</span>
                            <span className="text-muted-foreground">{formatHours(log.hours_worked)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Individual log entries */}
                <div className="space-y-3">
                  {dayLogs.map(log => {
                    const job = log.jobs as LogEntry["jobs"]
                    return (
                      <div key={log.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: jobColors[log.job_id] }} />
                            <span className="font-medium text-sm">{job?.name}</span>
                            {job?.clients && (
                              <Badge variant="secondary" className="text-xs">
                                {(job.clients as { name: string }).name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{formatHours(log.hours_worked)} trab. / {formatHours(log.hours_billed)} fat.</div>
                            <div className="font-semibold text-foreground">{formatCurrency(log.total_value)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add another log to the same day */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => { setSelectedDay(null); setAddingDay(selectedDay) }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar outro registro neste dia
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick-add modal (feature 4) */}
      <Dialog open={!!addingDay} onOpenChange={open => !open && setAddingDay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Adicionar registro
            </DialogTitle>
            <DialogDescription>
              {addingDay && format(parseISO(addingDay), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {addingDay && (
            <QuickAddForm
              date={addingDay}
              jobs={jobs}
              onSaved={() => { setAddingDay(null); router.refresh() }}
              onCancel={() => setAddingDay(null)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
