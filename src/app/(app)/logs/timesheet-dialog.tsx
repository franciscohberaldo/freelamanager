"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileSpreadsheet, Download } from "lucide-react"
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Props {
  jobs: { id: string; name: string }[]
  children: React.ReactNode
}

const WEEK_STARTS = [
  { value: "0", label: "Domingo a sábado (padrão EUA / Deltek)" },
  { value: "1", label: "Segunda a domingo" },
]

export function TimesheetDialog({ jobs, children }: Props) {
  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "")
  const [week, setWeek] = useState(format(new Date(), "yyyy-MM-dd"))
  const [weekStart, setWeekStart] = useState("0")

  const ws = Number(weekStart) as 0 | 1
  const anchor = week ? parseISO(week) : new Date()
  const rangeLabel = Number.isNaN(anchor.getTime())
    ? ""
    : `${format(startOfWeek(anchor, { weekStartsOn: ws }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(anchor, { weekStartsOn: ws }), "dd MMM yyyy", { locale: ptBR })}`

  function download() {
    if (!jobId) return
    const params = new URLSearchParams({ job_id: jobId, week, week_start: weekStart })
    window.open(`/api/reports/timesheet?${params.toString()}`, "_blank")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Timesheet semanal</DialogTitle>
          <DialogDescription>Exporta um CSV com um dia por linha para conferir com o sistema do cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Job</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger><SelectValue placeholder="Selecione o job" /></SelectTrigger>
              <SelectContent>
                {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Qualquer dia da semana</Label>
              <Input type="date" value={week} onChange={e => setWeek(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Semana</Label>
              <Select value={weekStart} onValueChange={setWeekStart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEK_STARTS.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {rangeLabel && <p className="text-xs text-muted-foreground">Período: {rangeLabel}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={download} disabled={!jobId}><Download className="w-4 h-4" /> Baixar CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
