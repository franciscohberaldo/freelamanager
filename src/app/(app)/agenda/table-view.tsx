"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
import { TaskDialog } from "./task-dialog"
import type { AgendaEvent } from "@/lib/supabase/types"

interface Job { id: string; name: string; start_date: string | null; end_date: string | null; status: string }
interface Props {
  events: (AgendaEvent & { jobs: { name: string } | null })[]
  jobs: Job[]
  onNew: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  working_on_it: { label: "Working on it", color: "#fff",     bg: "#f59e0b" },
  done:          { label: "Done",          color: "#fff",     bg: "#22c55e" },
  stuck:         { label: "Stuck",         color: "#fff",     bg: "#ef4444" },
  todo:          { label: "To-Do",         color: "#64748b",  bg: "#f1f5f9" },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "#fff", bg: "#3b82f6" },
  medium: { label: "Medium", color: "#fff", bg: "#a855f7" },
  high:   { label: "High",   color: "#fff", bg: "#f59e0b" },
}

const GROUPS = [
  { key: "todo",          label: "To-Do",          color: "#94a3b8" },
  { key: "working_on_it", label: "Working on it",  color: "#f59e0b" },
  { key: "stuck",         label: "Stuck",          color: "#ef4444" },
  { key: "done",          label: "Completed",      color: "#22c55e" },
]

export function TableView({ events, jobs, onNew }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editTask, setEditTask] = useState<(AgendaEvent & { jobs: { name: string } | null }) | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function toggle(key: string) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }))
  }

  async function cycleStatus(task: AgendaEvent) {
    const order: AgendaEvent["task_status"][] = ["todo", "working_on_it", "done", "stuck"]
    const next = order[(order.indexOf(task.task_status) + 1) % order.length]
    await supabase.from("agenda_events").update({ task_status: next, is_done: next === "done" }).eq("id", task.id)
    router.refresh()
  }

  const grouped = GROUPS.map(g => ({
    ...g,
    tasks: events.filter(e => e.task_status === g.key),
  }))

  const totalBudget = events.reduce((s, e) => s + (e.budget ?? 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
            <th className="text-left px-4 py-2 w-64 font-medium">Tarefa</th>
            <th className="text-left px-3 py-2 w-36 font-medium">Status</th>
            <th className="text-left px-3 py-2 w-28 font-medium">Prazo</th>
            <th className="text-left px-3 py-2 w-28 font-medium">Budget</th>
            <th className="text-left px-3 py-2 w-36 font-medium">Timeline</th>
            <th className="text-left px-3 py-2 w-24 font-medium">Prioridade</th>
            <th className="text-left px-3 py-2 font-medium">Notas</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(group => (
            <>
              {/* Group header */}
              <tr
                key={`group-${group.key}`}
                className="border-b cursor-pointer select-none hover:bg-muted/20"
                onClick={() => toggle(group.key)}
              >
                <td colSpan={7} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {collapsed[group.key] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <span className="w-3 h-3 rounded-sm" style={{ background: group.color }} />
                    <span className="font-semibold text-sm">{group.label}</span>
                    <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
                  </div>
                </td>
              </tr>

              {/* Tasks */}
              {!collapsed[group.key] && group.tasks.map(task => (
                <tr
                  key={task.id}
                  className="border-b hover:bg-muted/20 cursor-pointer group"
                  onClick={() => setEditTask(task)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1 h-5 rounded-full shrink-0"
                        style={{ background: group.color }}
                      />
                      <span className="truncate max-w-52">{task.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); cycleStatus(task) }}>
                    {task.task_status && STATUS_CONFIG[task.task_status] ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium cursor-pointer"
                        style={{
                          background: STATUS_CONFIG[task.task_status].bg,
                          color: STATUS_CONFIG[task.task_status].color,
                        }}
                      >
                        {STATUS_CONFIG[task.task_status].label}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {task.event_date ? formatDate(task.event_date, "dd MMM") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {task.budget ? formatCurrency(task.budget) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {task.start_date && task.event_date
                      ? `${formatDate(task.start_date, "dd/MM")} – ${formatDate(task.event_date, "dd/MM")}`
                      : task.event_date ? formatDate(task.event_date, "dd/MM") : "—"
                    }
                  </td>
                  <td className="px-3 py-2.5">
                    {task.priority && PRIORITY_CONFIG[task.priority] ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: PRIORITY_CONFIG[task.priority].bg,
                          color: PRIORITY_CONFIG[task.priority].color,
                        }}
                      >
                        {PRIORITY_CONFIG[task.priority].label}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-40">
                    {task.description ?? "—"}
                  </td>
                </tr>
              ))}

              {/* Add task row */}
              {!collapsed[group.key] && (
                <tr key={`add-${group.key}`} className="border-b">
                  <td colSpan={7} className="px-4 py-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={onNew}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar tarefa
                    </Button>
                  </td>
                </tr>
              )}

              {/* Group totals */}
              {!collapsed[group.key] && group.tasks.length > 0 && (
                <tr key={`total-${group.key}`} className="border-b bg-muted/10 text-xs text-muted-foreground">
                  <td className="px-4 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 font-medium">
                    {formatCurrency(group.tasks.reduce((s, t) => s + (t.budget ?? 0), 0))}
                  </td>
                  <td colSpan={3} className="px-3 py-1.5" />
                </tr>
              )}
            </>
          ))}

          {/* Grand total */}
          <tr className="bg-muted/20 text-xs font-medium">
            <td className="px-4 py-2">{events.length} tarefas</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2">{formatCurrency(totalBudget)}</td>
            <td colSpan={3} className="px-3 py-2" />
          </tr>
        </tbody>
      </table>

      {/* Edit dialog */}
      {editTask && (
        <TaskDialog
          jobs={jobs}
          open={!!editTask}
          onOpenChange={v => { if (!v) setEditTask(null) }}
          task={editTask}
        >
          <span />
        </TaskDialog>
      )}
    </div>
  )
}
