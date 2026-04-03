"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, subMonths, addMonths, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  jobs: { id: string; name: string }[]
  currentMonth: string
  currentJobId?: string
}

export function LogFilters({ jobs, currentMonth, currentJobId }: Props) {
  const router = useRouter()

  function navigate(month: string, jobId?: string) {
    const params = new URLSearchParams()
    params.set("month", month)
    if (jobId && jobId !== "all") params.set("job_id", jobId)
    router.push(`/logs?${params.toString()}`)
  }

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => navigate(prevMonth, currentJobId)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium w-36 text-center capitalize">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={() => navigate(nextMonth, currentJobId)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Select
        defaultValue={currentJobId ?? "all"}
        onValueChange={(v) => navigate(currentMonth, v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Todos os jobs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os jobs</SelectItem>
          {jobs.map((j) => (
            <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
