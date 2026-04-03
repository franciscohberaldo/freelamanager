"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday, parseISO, subMonths, addMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { formatCurrency, formatHours } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogDialog } from "./log-dialog"
import { LogTimerButton } from "./log-timer-button"
import { Plus, Play, Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import type { DailyLog } from "@/lib/supabase/types"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  currency: string
  clients: { name: string } | null
}

interface LogWithJob extends DailyLog {
  jobs: { name: string; hourly_rate: number; currency: string; clients: { name: string } | null } | null
}

interface Props {
  logs: LogWithJob[]
  jobs: JobOption[]
  currentMonth: string
}

function formatLogDate(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d))     return "Hoje"
  if (isYesterday(d)) return "Ontem"
  return format(d, "dd MMM", { locale: ptBR })
}

function formatHoursShort(h: number) {
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (min === 0) return `${hrs}h`
  return `${hrs}h ${String(min).padStart(2, "0")}min`
}

export function LogsClient({ logs, jobs, currentMonth }: Props) {
  const [search, setSearch] = useState("")
  const router = useRouter()

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth   = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth   = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel  = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter(l => {
      const job = l.jobs as LogWithJob["jobs"]
      return (
        job?.name?.toLowerCase().includes(q) ||
        job?.clients?.name?.toLowerCase().includes(q) ||
        l.meetings?.toLowerCase().includes(q) ||
        l.requests?.toLowerCase().includes(q)
      )
    })
  }, [logs, search])

  const totals = useMemo(() => ({
    hours: filtered.reduce((s, l) => s + l.hours_worked, 0),
    value: filtered.reduce((s, l) => s + l.total_value, 0),
    count: filtered.length,
  }), [filtered])

  function navigate(month: string) {
    router.push(`/logs?month=${month}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-none">
            Registro Diário
            <span className="text-muted-foreground font-normal text-base ml-2">/ Timesheet</span>
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LogDialog jobs={jobs} mode="create">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
              <Plus className="w-4 h-4" />
              Novo registro
            </Button>
          </LogDialog>
          <LogDialog jobs={jobs} mode="create">
            <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
              <Play className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
              Iniciar timer
            </Button>
          </LogDialog>
        </div>

        {/* Search + filter + period */}
        <div className="flex items-center gap-2 ml-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 h-8 w-48 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtrar
          </Button>
          <div className="flex items-center border rounded-md h-8">
            <Button variant="ghost" size="icon" className="h-8 w-7 rounded-r-none" onClick={() => navigate(prevMonth)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-medium px-2 capitalize whitespace-nowrap">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-7 rounded-l-none" onClick={() => navigate(nextMonth)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 px-6 py-2.5 border-b bg-muted/20 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{formatHoursShort(totals.hours)}</span>
        </span>
        <span className="text-muted-foreground/40">|</span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Registros:</span>
          <span className="font-semibold">{totals.count}</span>
        </span>
        <span className="text-muted-foreground/40">|</span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Valor estimado:</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.value)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20 text-muted-foreground text-xs sticky top-0">
              <th className="text-left px-6 py-2.5 font-medium w-28">DATA</th>
              <th className="text-left px-4 py-2.5 font-medium w-44">JOB</th>
              <th className="text-left px-4 py-2.5 font-medium w-36">CLIENTE</th>
              <th className="text-left px-4 py-2.5 font-medium">DESCRIÇÃO</th>
              <th className="text-left px-4 py-2.5 font-medium w-28">HORAS</th>
              <th className="text-left px-4 py-2.5 font-medium w-32">STATUS</th>
              <th className="px-4 py-2.5 w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground text-sm">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {filtered.map(log => {
              const job = log.jobs as LogWithJob["jobs"]
              const desc = log.meetings || log.requests || ""
              return (
                <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-3 text-muted-foreground text-xs font-medium">
                    {formatLogDate(log.date)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {job?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job?.clients?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    <span className="line-clamp-1">{desc || "—"}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatHoursShort(log.hours_worked)}
                  </td>
                  <td className="px-4 py-3">
                    {log.hours_billed > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Concluído
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        Em andamento
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <LogTimerButton logId={log.id} hoursWorked={log.hours_worked} />
                      <LogDialog jobs={jobs} log={log} mode="edit">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
                      </LogDialog>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
