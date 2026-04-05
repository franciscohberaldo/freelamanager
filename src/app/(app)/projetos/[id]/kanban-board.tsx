"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface ChecklistItem {
  id: string; text: string; is_done: boolean; position: number
}

interface Task {
  id: string; title: string; description: string | null; status: string
  progress: number; start_date: string | null; end_date: string | null; position: number
  project_task_items?: ChecklistItem[]
}

interface Props {
  tasks: Task[]
  projectColor: string
  onEdit: (task: Task) => void
}

const COLUMNS = [
  { id: "todo",        label: "A fazer",       color: "#94a3b8" },
  { id: "in_progress", label: "Em andamento",  color: "#3b82f6" },
  { id: "blocked",     label: "Bloqueado",      color: "#ef4444" },
  { id: "done",        label: "Concluído",     color: "#22c55e" },
]

function ChecklistPreview({ items }: { items: ChecklistItem[] }) {
  if (!items.length) return null
  const done  = items.filter(i => i.is_done).length
  const total = items.length
  const pct   = Math.round((done / total) * 100)
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{done}/{total} itens</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function KanbanCard({
  task, onEdit, onStatusChange,
}: {
  task: Task; onEdit: (t: Task) => void; onStatusChange: (id: string, status: string) => void
}) {
  const [dragging, setDragging] = useState(false)
  const items = task.project_task_items ?? []

  return (
    <div
      draggable
      onDragStart={e => {
        setDragging(true)
        e.dataTransfer.setData("taskId", task.id)
        e.dataTransfer.setData("fromStatus", task.status)
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onEdit(task)}
      className={[
        "rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-all select-none",
        dragging ? "opacity-40 scale-95" : "",
      ].join(" ")}
    >
      {task.progress > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progresso</span>
          <span>{task.progress}%</span>
        </div>
      )}
      {task.progress > 0 && (
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: "#3b82f6" }} />
        </div>
      )}
      <p className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
        {task.title}
      </p>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}
      {(task.start_date || task.end_date) && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {task.start_date ?? "?"} → {task.end_date ?? "?"}
        </p>
      )}
      <ChecklistPreview items={items} />
    </div>
  )
}

function KanbanColumn({
  column, tasks, onEdit, onDrop,
}: {
  column: typeof COLUMNS[0]
  tasks: Task[]
  onEdit: (t: Task) => void
  onDrop: (taskId: string, newStatus: string) => void
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={[
        "flex flex-col gap-2 min-w-[220px] flex-1",
        "rounded-xl border p-3 transition-colors",
        over ? "bg-accent/50 border-primary/40" : "bg-muted/10",
      ].join(" ")}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        const taskId = e.dataTransfer.getData("taskId")
        if (taskId) onDrop(taskId, column.id)
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: column.color }} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{column.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-1.5">{tasks.length}</span>
      </div>

      {tasks.map(t => (
        <KanbanCard key={t.id} task={t} onEdit={onEdit} onStatusChange={() => {}} />
      ))}

      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center min-h-16 text-xs text-muted-foreground/50 border-2 border-dashed rounded-lg">
          Solte aqui
        </div>
      )}
    </div>
  )
}

export function KanbanBoard({ tasks, projectColor, onEdit }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const [moving, setMoving] = useState<string | null>(null)
  const [localTasks, setLocalTasks] = useState(tasks)

  // Keep local state in sync with prop changes
  const prevTasksRef = useRef(tasks)
  if (tasks !== prevTasksRef.current) {
    prevTasksRef.current = tasks
    setLocalTasks(tasks)
  }

  async function handleDrop(taskId: string, newStatus: string) {
    const task = localTasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    setMoving(taskId)

    const { error } = await supabase
      .from("project_tasks")
      .update({ status: newStatus })
      .eq("id", taskId)

    setMoving(null)

    if (error) {
      toast.error("Erro ao mover tarefa")
      setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
    } else {
      router.refresh()
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.id}
          column={col}
          tasks={localTasks.filter(t => t.status === col.id)}
          onEdit={onEdit}
          onDrop={handleDrop}
        />
      ))}
    </div>
  )
}
