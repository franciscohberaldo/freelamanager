"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Table2, GitBranch, BarChart2, CalendarDays } from "lucide-react"
import { TaskDialog } from "./task-dialog"
import { TableView } from "./table-view"
import { GanttView } from "./gantt-view"
import { CalendarView } from "./calendar-view"
import { TimelineView } from "./timeline-view"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job { id: string; name: string; start_date: string | null; end_date: string | null; status: string }

interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  jobs: Job[]
}

export function AgendaClient({ events, jobs }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-bold">Acompanhamento de Jobs</h1>
        <TaskDialog jobs={jobs} open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Nova tarefa
          </Button>
        </TaskDialog>
      </div>

      <Tabs defaultValue="table" className="flex-1 flex flex-col">
        <div className="px-6 border-b">
          <TabsList className="h-9 bg-transparent p-0 gap-0 rounded-none">
            {[
              { value: "table",    label: "Tabela",   icon: Table2 },
              { value: "timeline", label: "Timeline", icon: GitBranch },
              { value: "gantt",    label: "Gantt",    icon: BarChart2 },
              { value: "calendar", label: "Calendário", icon: CalendarDays },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-9 text-sm"
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="table" className="flex-1 m-0">
          <TableView events={events} jobs={jobs} onNew={() => setDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="timeline" className="flex-1 m-0 overflow-auto p-6">
          <TimelineView events={events} jobs={jobs} />
        </TabsContent>
        <TabsContent value="gantt" className="flex-1 m-0 overflow-auto p-6">
          <GanttView events={events} jobs={jobs} />
        </TabsContent>
        <TabsContent value="calendar" className="flex-1 m-0 overflow-auto p-6">
          <CalendarView events={events} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
