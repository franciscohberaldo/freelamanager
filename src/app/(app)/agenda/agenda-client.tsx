"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Plus, Table2, GitBranch, BarChart2, CalendarDays } from "lucide-react"
import { TaskDialog } from "./task-dialog"
import { TableView } from "./table-view"
import { GanttView } from "./gantt-view"
import { CalendarView, type CalendarHold } from "./calendar-view"
import { TimelineView } from "./timeline-view"
import type { DayLog } from "./day-dialog"
import type { JobOption } from "../logs/log-dialog"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job { id: string; name: string; start_date: string | null; end_date: string | null; status: string }

export type AgendaJob = Job & JobOption

interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  jobs: AgendaJob[]
  holds: CalendarHold[]
  logs: DayLog[]
}

export function AgendaClient({ events, jobs, holds, logs }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  // Pickers (new task, new daily log) only offer jobs still open; the calendar and
  // timeline show every job, including completed ones, so the history stays visible.
  const openJobs = jobs.filter(j => j.status !== "completed")

  return (
    <div className="px-8 py-6">
      <PageHeader
        eyebrow="Planejamento"
        title="Agenda de projetos"
        description="Organize entregas, tarefas e períodos de trabalho em uma visão única."
        actions={
          <TaskDialog jobs={openJobs} open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button size="lg">
              <Plus className="w-4 h-4" />
              Nova tarefa
            </Button>
          </TaskDialog>
        }
      />

      <Tabs defaultValue="calendar">
        <TabsList>
          {[
            { value: "calendar", label: "Calendário", icon: CalendarDays },
            { value: "table",    label: "Tabela",   icon: Table2 },
            { value: "timeline", label: "Timeline", icon: GitBranch },
            { value: "gantt",    label: "Gantt",    icon: BarChart2 },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="calendar">
          <CalendarView events={events} holds={holds} logs={logs} jobs={jobs} pickerJobs={openJobs} />
        </TabsContent>
        <TabsContent value="table">
          <TableView events={events} jobs={jobs} onNew={() => setDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineView events={events} jobs={jobs} />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttView events={events} jobs={jobs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
