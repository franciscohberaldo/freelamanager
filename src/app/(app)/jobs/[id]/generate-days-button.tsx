"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarPlus, ChevronDown, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { missingDays, logForDay, type SpanJob } from "@/lib/job-days"

interface Props {
  job: SpanJob
  userId: string
  /** Dates that already have a log, so they are not created twice. */
  existing: string[]
}

/**
 * Turns the job's start→end span into daily logs, one per day still missing. Weekdays
 * by default; the second option also fills Saturday and Sunday.
 */
export function GenerateDaysButton({ job, userId, existing }: Props) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  if (!job.start_date || !job.end_date) return null

  const weekdays = missingDays(job, existing, false)
  const allDays  = missingDays(job, existing, true)
  if (allDays.length === 0) return null

  async function generate(includeWeekends: boolean) {
    const dates = includeWeekends ? allDays : weekdays
    if (dates.length === 0) { toast.info("Todos os dias úteis do período já têm diária."); return }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from("daily_logs").insert(dates.map(d => logForDay(job, d, userId)))
    if (error) { toast.error(`Erro ao gerar diárias: ${error.message}`); setBusy(false); return }
    toast.success(`${dates.length} ${dates.length === 1 ? "diária criada" : "diárias criadas"}`)
    setBusy(false)
    router.refresh()
  }

  const range = `${job.start_date.slice(8, 10)}/${job.start_date.slice(5, 7)} – ${job.end_date.slice(8, 10)}/${job.end_date.slice(5, 7)}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
          Gerar do período
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => generate(false)} disabled={weekdays.length === 0}>
          <span className="flex-1">Dias úteis de {range}</span>
          <span className="text-xs text-muted-foreground tabular">{weekdays.length}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => generate(true)}>
          <span className="flex-1">Todos os dias, com fim de semana</span>
          <span className="text-xs text-muted-foreground tabular">{allDays.length}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
