"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, Plus, Star, Link2, Copy, Phone, Mail, Briefcase, Loader2 } from "lucide-react"
import Link from "next/link"

interface Props {
  client: {
    id: string; name: string; company: string | null; email: string | null
    phone: string | null; notes: string | null; score: number | null
    client_contacts: { id: string; name: string; role: string | null; email: string | null }[]
  }
  interactions: {
    id: string; type: string; summary: string; happened_at: string
  }[]
  jobs: {
    id: string; name: string; status: string; hourly_rate: number; currency: string
    start_date: string | null; end_date: string | null
  }[]
  invoices: {
    id: string; invoice_number: string; total: number; currency: string; status: string
    period_start: string; period_end: string
  }[]
  portalToken: string | null
}

const INTERACTION_TYPES = [
  { value: "email",    label: "E-mail",   emoji: "📧" },
  { value: "call",     label: "Ligação",  emoji: "📞" },
  { value: "meeting",  label: "Reunião",  emoji: "🗣️" },
  { value: "note",     label: "Nota",     emoji: "📝" },
  { value: "proposal", label: "Proposta", emoji: "📋" },
]
const ITYPE = Object.fromEntries(INTERACTION_TYPES.map(t => [t.value, t]))

const JOB_STATUS: Record<string, string> = {
  proposal: "Proposta", active: "Ativo", paused: "Pausado", completed: "Finalizado",
}
const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: "Rascunho", color: "text-muted-foreground" },
  sent:    { label: "Enviado",  color: "text-amber-600" },
  paid:    { label: "Pago",     color: "text-green-600" },
  overdue: { label: "Vencido",  color: "text-destructive" },
}

function AddInteractionDialog({ clientId, open, onClose }: {
  clientId: string; open: boolean; onClose: () => void
}) {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type:        "note",
    summary:     "",
    happened_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.summary.trim()) { toast.error("Descrição obrigatória"); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("client_interactions").insert({
      user_id:     user!.id,
      client_id:   clientId,
      type:        form.type,
      summary:     form.summary,
      happened_at: form.happened_at,
    })
    if (error) { toast.error("Erro ao registrar"); setLoading(false); return }
    toast.success("Interação registrada!")
    onClose()
    router.refresh()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar interação</DialogTitle>
          <DialogDescription className="sr-only">Registrar contato ou nota sobre o cliente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data/hora</Label>
              <Input type="datetime-local" value={form.happened_at}
                onChange={e => setForm(f => ({ ...f, happened_at: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              rows={4} placeholder="O que aconteceu neste contato?" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ClientDetailClient({ client, interactions, jobs, invoices, portalToken }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const [score, setScore]         = useState(client.score ?? 0)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [token, setToken]                     = useState(portalToken)

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0)
  const portalUrl    = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${token}` : null

  async function handleScoreChange(s: number) {
    setScore(s)
    await supabase.from("clients").update({ score: s }).eq("id", client.id)
  }

  async function generatePortalToken() {
    setGeneratingToken(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from("client_portal_tokens").upsert({
      user_id:   user!.id,
      client_id: client.id,
    }, { onConflict: "client_id" }).select("token").single()
    if (error || !data) { toast.error("Erro ao gerar link"); setGeneratingToken(false); return }
    setToken(data.token)
    toast.success("Link gerado!")
    setGeneratingToken(false)
  }

  function copyPortalUrl() {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl)
    toast.success("Link copiado!")
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {client.company && <p className="text-muted-foreground">{client.company}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + score + portal */}
        <div className="space-y-4">
          {/* Contact info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Contato</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="w-3.5 h-3.5" /> {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="w-3.5 h-3.5" /> {client.phone}
                </a>
              )}
              {client.notes && (
                <p className="text-muted-foreground text-xs mt-2 leading-relaxed">{client.notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Score */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Score do cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => handleScoreChange(s)}
                    className="transition-transform hover:scale-110">
                    <Star className={`w-6 h-6 ${s <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                {score > 0 && (
                  <button onClick={() => handleScoreChange(0)} className="ml-1 text-xs text-muted-foreground hover:text-foreground">
                    limpar
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {score === 0 ? "Sem score" : score === 5 ? "Cliente premium" : score >= 4 ? "Ótimo relacionamento" : score >= 3 ? "Bom relacionamento" : score >= 2 ? "Relacionamento razoável" : "Requer atenção"}
              </p>
            </CardContent>
          </Card>

          {/* Financial summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Financeiro</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">LTV (recebido)</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jobs</span>
                <span>{jobs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoices</span>
                <span>{invoices.length}</span>
              </div>
              {invoices.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket médio</span>
                  <span>{formatCurrency(invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+i.total,0) / Math.max(invoices.filter(i=>i.status==="paid").length, 1))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portal link */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Portal do cliente
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {token ? (
                <>
                  <p className="text-xs text-muted-foreground break-all font-mono bg-muted rounded p-2">
                    /portal/{token.slice(0, 16)}…
                  </p>
                  <Button size="sm" variant="outline" className="w-full gap-2" onClick={copyPortalUrl}>
                    <Copy className="w-3.5 h-3.5" /> Copiar link
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Gere um link público para o cliente ver invoices e status de projetos.
                  </p>
                  <Button size="sm" className="w-full gap-2" onClick={generatePortalToken} disabled={generatingToken}>
                    {generatingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Gerar link do portal
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: timeline + jobs + invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interaction timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Histórico de interações</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                onClick={() => setInteractionOpen(true)}>
                <Plus className="w-3 h-3" /> Registrar
              </Button>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma interação registrada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {interactions.map((i, idx) => {
                    const t = ITYPE[i.type]
                    return (
                      <div key={i.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                            {t?.emoji ?? "📌"}
                          </div>
                          {idx < interactions.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium">{t?.label ?? i.type}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(i.happened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{i.summary}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Jobs */}
          {jobs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Jobs
              </CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {jobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <Link href={`/jobs`} className="text-sm font-medium hover:underline">{job.name}</Link>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(job.hourly_rate, job.currency)}/h
                          {job.start_date && ` · desde ${format(new Date(job.start_date + "T12:00"), "MM/yyyy")}`}
                        </p>
                      </div>
                      <Badge variant={job.status === "active" ? "default" : "outline"} className="text-xs">
                        {JOB_STATUS[job.status] ?? job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Invoices</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoices.slice(0, 8).map(inv => {
                    const st = INV_STATUS[inv.status]
                    return (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">#{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(inv.period_start + "T12:00"), "MMM yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</p>
                          <p className={`text-xs font-medium ${st?.color}`}>{st?.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AddInteractionDialog
        clientId={client.id}
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
      />
    </div>
  )
}
