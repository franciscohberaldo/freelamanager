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
import { Combobox } from "@/components/ui/combobox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, FolderKanban, CalendarRange, ChevronRight, BookTemplate, Save } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"

interface Task { id: string; status: string; title: string; description: string | null; progress: number }
interface Project {
  id: string; name: string; description: string | null; status: string
  color: string; start_date: string | null; end_date: string | null
  clients: { name: string } | null; project_tasks: Task[]
}
interface Client { id: string; name: string }
interface Template {
  id: string; name: string
  tasks: { title: string; description: string | null; status: string; progress: number }[]
}
interface Props { projects: Project[]; clients: Client[]; templates: Template[] }

const STATUS_LABEL: Record<string, string> = {
  planning: "Planejamento", active: "Em andamento",
  on_hold: "Pausado", completed: "Concluído", cancelled: "Cancelado",
}
const STATUS_COLOR: Record<string, string> = {
  planning: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  on_hold:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed:"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled:"bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}
const COLORS = ["#7c3aed","#2563eb","#0891b2","#16a34a","#d97706","#dc2626","#db2777","#475569"]

function NewProjectDialog({
  clients, templates, onCreated,
}: {
  clients: Client[]; templates: Template[]; onCreated: () => void
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const [templateId, setTemplateId] = useState("")
  const [form, setForm] = useState({
    name: "", description: "", client_id: "", status: "active",
    color: "#7c3aed", start_date: "", end_date: "",
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function applyTemplate(tid: string) {
    setTemplateId(tid)
    const tpl = templates.find(t => t.id === tid)
    if (tpl && !form.name) set("name", tpl.name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: proj, error } = await supabase.from("projects").insert({
      user_id:     user!.id,
      name:        form.name,
      description: form.description || null,
      client_id:   form.client_id === "none" || !form.client_id ? null : form.client_id,
      status:      form.status,
      color:       form.color,
      start_date:  form.start_date || null,
      end_date:    form.end_date || null,
    }).select().single()

    if (error || !proj) { toast.error("Erro ao criar projeto"); setLoading(false); return }

    // Apply template tasks
    if (templateId) {
      const tpl = templates.find(t => t.id === templateId)
      if (tpl?.tasks?.length) {
        await supabase.from("project_tasks").insert(
          tpl.tasks.map((t, i) => ({
            project_id:  proj.id,
            user_id:     user!.id,
            title:       t.title,
            description: t.description,
            status:      "todo",
            progress:    0,
            position:    i,
          }))
        )
      }
    }

    toast.success("Projeto criado!")
    setOpen(false)
    setForm({ name:"", description:"", client_id:"", status:"active", color:"#7c3aed", start_date:"", end_date:"" })
    setTemplateId("")
    onCreated()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" />Novo Projeto</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
          <DialogDescription className="sr-only">Criar novo projeto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Usar template (opcional)</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem template</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.tasks.length} tarefas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Website Redesign" required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Objetivo do projeto..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Combobox
                options={[{ value: "none", label: "Nenhum" }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                value={form.client_id}
                onChange={v => set("client_id", v)}
                placeholder="Nenhum"
                searchPlaceholder="Buscar cliente…"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Criar Projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Save a project as template
function SaveTemplateButton({ project }: { project: Project }) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  async function save() {
    if (!confirm(`Salvar "${project.name}" como template?`)) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const tasks = project.project_tasks.map(t => ({
      title:       t.title,
      description: t.description,
      status:      "todo",
      progress:    0,
    }))
    const { error } = await supabase.from("project_templates").insert({
      user_id: user!.id,
      name:    project.name,
      tasks,
    })
    if (error) toast.error("Erro ao salvar template")
    else { toast.success("Template salvo!"); router.refresh() }
    setLoading(false)
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"
      title="Salvar como template" onClick={e => { e.preventDefault(); save() }}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
    </Button>
  )
}

export function ProjectsClient({ projects, clients, templates }: Props) {
  const router = useRouter()

  return (
    <div className="px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Planejamento"
        title="Projetos"
        description={
          <>
            {projects.length} projeto{projects.length !== 1 ? "s" : ""}
            {templates.length > 0 && ` · ${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </>
        }
        actions={<NewProjectDialog clients={clients} templates={templates} onCreated={() => router.refresh()} />}
      />

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <FolderKanban className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">Nenhum projeto ainda</p>
          <p className="text-sm mt-1">Crie seu primeiro projeto para visualizar o Kanban e Gantt</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map(p => {
          const tasks = p.project_tasks ?? []
          const done  = tasks.filter(t => t.status === "done").length
          const pct   = tasks.length ? Math.round((done / tasks.length) * 100) : 0
          return (
            <Link key={p.id} href={`/projetos/${p.id}`}
              className="block rounded-xl border bg-card p-5 hover:shadow-md transition-all group relative">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{p.name}</p>
                    {p.clients && <p className="text-xs text-muted-foreground truncate">{p.clients.name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <SaveTemplateButton project={p} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </div>

              {p.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
              )}

              {/* Progress */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{done}/{tasks.length} tarefas</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                </div>
              </div>

              {/* Dates */}
              {(p.start_date || p.end_date) && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>
                    {p.start_date ? format(parseISO(p.start_date), "dd MMM", { locale: ptBR }) : "—"}
                    {" → "}
                    {p.end_date ? format(parseISO(p.end_date), "dd MMM yyyy", { locale: ptBR }) : "—"}
                  </span>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
