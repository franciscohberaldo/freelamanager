"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GanttChart } from "./gantt-chart"
import { KanbanBoard } from "./kanban-board"
import { ChevronLeft, Plus, Loader2, Pencil, Trash2, GanttChartSquare, List, LayoutGrid, Check, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ChecklistItem {
  id: string; text: string; is_done: boolean; position: number
}
interface Task {
  id: string; title: string; description: string | null; status: string
  progress: number; start_date: string | null; end_date: string | null; position: number
  project_task_items?: ChecklistItem[]
}
interface Project {
  id: string; name: string; description: string | null; status: string
  color: string; start_date: string | null; end_date: string | null
  clients: { name: string } | null
}
interface Props { project: Project; tasks: Task[] }

const STATUS_OPTS = [
  { value: "todo",        label: "A fazer",       color: "bg-slate-100 text-slate-700" },
  { value: "in_progress", label: "Em andamento",  color: "bg-blue-100 text-blue-700" },
  { value: "done",        label: "Concluído",     color: "bg-emerald-100 text-emerald-700" },
  { value: "blocked",     label: "Bloqueado",     color: "bg-red-100 text-red-700" },
]
const STATUS_DOT: Record<string, string> = {
  todo: "#94a3b8", in_progress: "#3b82f6", done: "#22c55e", blocked: "#ef4444",
}

// ─── Checklist inside task dialog ───────────────────────────────────────────
function ChecklistEditor({
  taskId, items, onChange,
}: {
  taskId: string | undefined
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}) {
  const supabase = createClient()
  const [newText, setNewText] = useState("")

  async function addItem() {
    const text = newText.trim()
    if (!text) return
    if (!taskId) {
      // Pre-save: just local
      const temp: ChecklistItem = { id: crypto.randomUUID(), text, is_done: false, position: items.length }
      onChange([...items, temp])
      setNewText("")
      return
    }
    const { data, error } = await supabase.from("project_task_items").insert({
      task_id: taskId, text, is_done: false, position: items.length,
    }).select().single()
    if (error) { toast.error("Erro ao adicionar item"); return }
    onChange([...items, data as ChecklistItem])
    setNewText("")
  }

  async function toggleItem(item: ChecklistItem) {
    const updated = { ...item, is_done: !item.is_done }
    onChange(items.map(i => i.id === item.id ? updated : i))
    if (taskId) {
      await supabase.from("project_task_items").update({ is_done: updated.is_done }).eq("id", item.id)
    }
  }

  async function removeItem(item: ChecklistItem) {
    onChange(items.filter(i => i.id !== item.id))
    if (taskId) {
      await supabase.from("project_task_items").delete().eq("id", item.id)
    }
  }

  const done  = items.filter(i => i.is_done).length
  const total = items.length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Checklist {total > 0 ? `(${done}/${total})` : ""}</Label>
        {total > 0 && (
          <div className="flex items-center gap-2 flex-1 max-w-40 ml-3">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((done/total)*100)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round((done/total)*100)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button
              type="button"
              onClick={() => toggleItem(item)}
              className={[
                "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                item.is_done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 hover:border-emerald-400",
              ].join(" ")}
            >
              {item.is_done && <Check className="w-2.5 h-2.5 text-white" />}
            </button>
            <span className={`text-sm flex-1 ${item.is_done ? "line-through text-muted-foreground" : ""}`}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => removeItem(item)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder="Adicionar item..."
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={addItem}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Task Dialog ─────────────────────────────────────────────────────────────
function TaskDialog({
  task, projectId, open, onClose, onSaved,
}: {
  task?: Task; projectId: string; open: boolean; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title:       task?.title ?? "",
    description: task?.description ?? "",
    status:      task?.status ?? "todo",
    progress:    task?.progress ?? 0,
    start_date:  task?.start_date ?? "",
    end_date:    task?.end_date ?? "",
  })
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(task?.project_task_items ?? [])

  function set(k: string, v: string | number) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast.error("Título obrigatório"); return }
    setLoading(true)

    const payload = {
      title:       form.title,
      description: form.description || null,
      status:      form.status,
      progress:    Number(form.progress),
      start_date:  form.start_date || null,
      end_date:    form.end_date || null,
    }

    let savedTaskId = task?.id

    if (task) {
      const { error } = await supabase.from("project_tasks").update(payload).eq("id", task.id)
      if (error) { toast.error("Erro ao atualizar"); setLoading(false); return }
      toast.success("Tarefa atualizada!")
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("project_tasks")
        .insert({ ...payload, project_id: projectId, user_id: user!.id })
        .select()
        .single()
      if (error || !data) { toast.error("Erro ao criar tarefa"); setLoading(false); return }
      savedTaskId = (data as Task).id
      toast.success("Tarefa criada!")

      // Save any pending checklist items that were added before saving
      const pendingItems = checklistItems.filter(i => !task)
      if (pendingItems.length > 0 && savedTaskId) {
        await supabase.from("project_task_items").insert(
          pendingItems.map((item, idx) => ({
            task_id: savedTaskId, text: item.text, is_done: item.is_done, position: idx,
          }))
        )
      }
    }

    setLoading(false)
    onClose()
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription className="sr-only">Gerenciar tarefa do projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ex: Criar wireframes" required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progresso: {form.progress}%</Label>
              <Input type="range" min={0} max={100} step={5}
                value={form.progress} onChange={e => set("progress", Number(e.target.value))} className="mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data início</Label>
              <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          {/* Checklist */}
          <ChecklistEditor
            taskId={task?.id}
            items={checklistItems}
            onChange={setChecklistItems}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {task ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProjectClient({ project, tasks: initialTasks }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [tasks, setTasks]             = useState(initialTasks)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()

  function openNew()        { setEditingTask(undefined); setDialogOpen(true) }
  function openEdit(t: Task){ setEditingTask(t); setDialogOpen(true) }
  function onSaved()        { router.refresh() }

  async function deleteTask(id: string) {
    if (!confirm("Excluir esta tarefa?")) return
    const { error } = await supabase.from("project_tasks").delete().eq("id", id)
    if (error) { toast.error("Erro ao excluir"); return }
    toast.success("Tarefa excluída")
    router.refresh()
  }

  const done  = tasks.filter(t => t.status === "done").length
  const pct   = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/projetos" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 w-fit">
          <ChevronLeft className="w-4 h-4" /> Projetos
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0 mt-1" style={{ background: project.color }} />
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                {project.clients && <span>{(project.clients as any).name}</span>}
                {project.start_date && (
                  <span>
                    {format(parseISO(project.start_date), "dd MMM", { locale: ptBR })}
                    {project.end_date && ` → ${format(parseISO(project.end_date), "dd MMM yyyy", { locale: ptBR })}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={openNew} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{done} de {tasks.length} tarefas concluídas</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: project.color }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Gantt | Kanban | List */}
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <LayoutGrid className="w-4 h-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-2">
            <GanttChartSquare className="w-4 h-4" /> Gantt
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="w-4 h-4" /> Lista
          </TabsTrigger>
        </TabsList>

        {/* Kanban View */}
        <TabsContent value="kanban" className="mt-4">
          {tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma tarefa. Clique em "Nova Tarefa" para começar.
            </div>
          ) : (
            <KanbanBoard tasks={tasks} projectColor={project.color} onEdit={openEdit} />
          )}
        </TabsContent>

        {/* Gantt View */}
        <TabsContent value="gantt" className="mt-4">
          <GanttChart tasks={tasks} projectColor={project.color} />
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-4">
          {tasks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma tarefa. Clique em "Nova Tarefa" para começar.
            </div>
          )}
          <div className="space-y-2">
            {tasks.map(t => {
              const opt   = STATUS_OPTS.find(s => s.value === t.status)
              const items = t.project_task_items ?? []
              const doneItems = items.filter(i => i.is_done).length
              return (
                <div key={t.id}
                  className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 group hover:shadow-sm transition-shadow">
                  {/* Status dot */}
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_DOT[t.status] }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {(t.start_date || t.end_date) && (
                        <p className="text-xs text-muted-foreground">
                          {t.start_date ? format(parseISO(t.start_date), "dd MMM", { locale: ptBR }) : "—"}
                          {" → "}
                          {t.end_date ? format(parseISO(t.end_date), "dd MMM", { locale: ptBR }) : "—"}
                        </p>
                      )}
                      {items.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ✓ {doneItems}/{items.length}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {t.progress > 0 && (
                    <div className="w-20 space-y-0.5 shrink-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: STATUS_DOT[t.status] }} />
                      </div>
                      <p className="text-xs text-right text-muted-foreground">{t.progress}%</p>
                    </div>
                  )}

                  {/* Status badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${opt?.color}`}>
                    {opt?.label}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTask(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Dialog */}
      <TaskDialog
        task={editingTask}
        projectId={project.id}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={onSaved}
      />
    </div>
  )
}
