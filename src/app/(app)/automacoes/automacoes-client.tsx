"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2, Bell, RefreshCw, Mail, CheckCircle2, XCircle, Clock } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"

interface Settings {
  billing_reminder_enabled: boolean
  billing_reminder_days: number
  weekly_summary_enabled: boolean
  weekly_summary_day: number
  recurring_invoice_enabled: boolean
  recurring_invoice_job_id: string | null
  recurring_invoice_day: number
  recurring_invoice_frequency: "monthly" | "weekly"
  recurring_invoice_weekday: number
  recurring_invoice_week_start: number
  recurring_invoice_due_days: number
}

interface Job { id: string; name: string; clients: { name: string } | null }

interface AutoLog {
  id: string; type: string; payload: Record<string, unknown>
  status: string; error_msg: string | null; created_at: string
}

interface Props {
  initialSettings: Settings | null
  jobs: Job[]
  logs: AutoLog[]
}

const DAYS_OF_WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  billing_reminder:  { label: "Lembrete de cobrança", icon: Bell,       color: "#f59e0b" },
  weekly_summary:    { label: "Resumo semanal",        icon: Mail,       color: "#7c3aed" },
  recurring_invoice: { label: "Invoice recorrente",    icon: RefreshCw,  color: "#3b82f6" },
}

export function AutomacoesClient({ initialSettings, jobs, logs }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [s, setS] = useState<Settings>({
    billing_reminder_enabled:   initialSettings?.billing_reminder_enabled   ?? false,
    billing_reminder_days:      initialSettings?.billing_reminder_days      ?? 3,
    weekly_summary_enabled:     initialSettings?.weekly_summary_enabled     ?? false,
    weekly_summary_day:         initialSettings?.weekly_summary_day         ?? 1,
    recurring_invoice_enabled:  initialSettings?.recurring_invoice_enabled  ?? false,
    recurring_invoice_job_id:   initialSettings?.recurring_invoice_job_id   ?? null,
    recurring_invoice_day:      initialSettings?.recurring_invoice_day      ?? 1,
    recurring_invoice_frequency:  initialSettings?.recurring_invoice_frequency  ?? "monthly",
    recurring_invoice_weekday:    initialSettings?.recurring_invoice_weekday    ?? 5,
    recurring_invoice_week_start: initialSettings?.recurring_invoice_week_start ?? 0,
    recurring_invoice_due_days:   initialSettings?.recurring_invoice_due_days   ?? 30,
  })

  function upd<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("automation_settings").upsert({
      user_id: user!.id,
      ...s,
      recurring_invoice_job_id: s.recurring_invoice_job_id || null,
    }, { onConflict: "user_id" })

    if (error) toast.error("Erro ao salvar configurações")
    else { toast.success("Automações salvas!"); router.refresh() }
    setLoading(false)
  }

  async function testCron(endpoint: string) {
    const res = await fetch("/api/automations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    })
    const data = await res.json()
    if (res.ok) toast.success(`Executado: ${JSON.stringify(data)}`)
    else toast.error(`Erro: ${JSON.stringify(data)}`)
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Comunicação"
        title="Automações"
        description="Configure e-mails automáticos e ações recorrentes"
      />

      {/* Billing Reminders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Lembrete de cobrança</CardTitle>
                <CardDescription>E-mail automático para invoices vencidos</CardDescription>
              </div>
            </div>
            <Switch
              checked={s.billing_reminder_enabled}
              onCheckedChange={v => upd("billing_reminder_enabled", v)}
            />
          </div>
        </CardHeader>
        {s.billing_reminder_enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label>Enviar lembrete após quantos dias de vencimento?</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min={1} max={30}
                  value={s.billing_reminder_days}
                  onChange={e => upd("billing_reminder_days", parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">dia(s) após a data de vencimento</span>
              </div>
            </div>
            <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>• O e-mail é enviado automaticamente todos os dias às 08:00 UTC</p>
              <p>• O cliente recebe o e-mail no idioma cadastrado</p>
              <p>• Requer RESEND_API_KEY configurado no .env</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                <Mail className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">Resumo semanal</CardTitle>
                <CardDescription>Receba um e-mail com o resumo da semana anterior</CardDescription>
              </div>
            </div>
            <Switch
              checked={s.weekly_summary_enabled}
              onCheckedChange={v => upd("weekly_summary_enabled", v)}
            />
          </div>
        </CardHeader>
        {s.weekly_summary_enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label>Dia da semana para receber o resumo</Label>
              <Select
                value={String(s.weekly_summary_day)}
                onValueChange={v => upd("weekly_summary_day", parseInt(v))}
              >
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>• Contém: horas trabalhadas, valor faturado, despesas, invoices pendentes e próximos eventos</p>
              <p>• Enviado para o e-mail da sua conta</p>
              <p>• Executa toda segunda-feira às 08:00 UTC (ajuste em vercel.json)</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recurring Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Invoice recorrente</CardTitle>
                <CardDescription>Gera invoice automaticamente (mensal ou semanal) para um job</CardDescription>
              </div>
            </div>
            <Switch
              checked={s.recurring_invoice_enabled}
              onCheckedChange={v => upd("recurring_invoice_enabled", v)}
            />
          </div>
        </CardHeader>
        {s.recurring_invoice_enabled && (
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job (retainer)</Label>
                <Select
                  value={s.recurring_invoice_job_id ?? "none"}
                  onValueChange={v => upd("recurring_invoice_job_id", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar job" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecionar</SelectItem>
                    {jobs.map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.name}{j.clients ? ` · ${j.clients.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={s.recurring_invoice_frequency}
                  onValueChange={v => upd("recurring_invoice_frequency", v as "monthly" | "weekly")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal (mês anterior)</SelectItem>
                    <SelectItem value="weekly">Semanal (semana corrente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {s.recurring_invoice_frequency === "monthly" ? (
                <div className="space-y-2">
                  <Label>Dia do mês para gerar</Label>
                  <Input
                    type="number" min={1} max={28}
                    value={s.recurring_invoice_day}
                    onChange={e => upd("recurring_invoice_day", parseInt(e.target.value) || 1)}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Dia da semana para gerar</Label>
                    <Select
                      value={String(s.recurring_invoice_weekday)}
                      onValueChange={v => upd("recurring_invoice_weekday", parseInt(v))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Semana começa em</Label>
                    <Select
                      value={String(s.recurring_invoice_week_start)}
                      onValueChange={v => upd("recurring_invoice_week_start", parseInt(v))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Vencimento (dias após gerar)</Label>
                <Input
                  type="number" min={0} max={120}
                  value={s.recurring_invoice_due_days}
                  onChange={e => upd("recurring_invoice_due_days", parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">Ex.: 30 para Net 30</p>
              </div>
            </div>
            <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              {s.recurring_invoice_frequency === "weekly" ? (
                <p>• Toda {DAYS_OF_WEEK[s.recurring_invoice_weekday]}, gera um invoice draft com os registros da semana que começa em {DAYS_OF_WEEK[s.recurring_invoice_week_start]}</p>
              ) : (
                <p>• No dia configurado, o sistema gera um invoice draft com os logs do mês anterior</p>
              )}
              <p>• Jobs por diária são faturados em dias; a data de vencimento segue os dias configurados</p>
              <p>• Um lembrete &quot;Enviar invoice&quot; é criado na agenda no dia da geração</p>
              <p>• O invoice fica em rascunho para você revisar antes de enviar</p>
              <p>• Não gera invoice duplicado se já existir para o mesmo período</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Salvar automações
      </Button>

      {/* Activity Log */}
      {logs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Histórico de execuções
          </h2>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Detalhes</th>
                  <th className="text-left px-4 py-2.5 font-medium w-36">Data</th>
                  <th className="text-center px-4 py-2.5 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const meta = TYPE_LABELS[log.type]
                  const Icon = meta?.icon ?? Clock
                  return (
                    <tr key={log.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta?.color }} />
                          <span className="text-xs font-medium">{meta?.label ?? log.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                        {log.error_msg
                          ? log.error_msg
                          : Object.entries(log.payload ?? {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")
                        }
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {log.status === "ok"
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-destructive mx-auto" />
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRON_SECRET reminder */}
      <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Configuração necessária no Vercel</p>
        <p>Adicione a variável de ambiente <code className="bg-muted px-1 rounded">CRON_SECRET</code> com um valor secreto.</p>
        <p>Os crons são executados automaticamente pelo Vercel conforme os horários em <code className="bg-muted px-1 rounded">vercel.json</code>.</p>
        <p>Para testar manualmente: <code className="bg-muted px-1 rounded">POST /api/cron/billing-reminders?secret=SEU_SECRET</code></p>
      </div>
    </div>
  )
}
