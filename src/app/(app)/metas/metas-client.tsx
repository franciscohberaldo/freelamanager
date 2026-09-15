"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Target, Clock, TrendingUp, Wallet, Loader2, CheckCircle2 } from "lucide-react"
import { format, parseISO, subMonths, addMonths } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Goal {
  id: string; user_id: string; type: string; target: number; period: string
}

interface Props {
  goals: Goal[]
  currentMonth: string
  actualHours: number
  actualRevenue: number
  totalExpenses: number
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function GoalCard({
  label, icon: Icon, type, target, actual, unit, color, onSave,
}: {
  label: string; icon: React.ElementType; type: string; target: number | null
  actual: number; unit: string; color: string; onSave: (type: string, val: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(target ? String(target) : "")
  const [loading, setLoading] = useState(false)

  const pct       = target && target > 0 ? Math.min((actual / target) * 100, 100) : 0
  const achieved  = target ? actual >= target : false
  const remaining = target ? Math.max(target - actual, 0) : null

  async function handleSave() {
    const num = parseFloat(value)
    if (!num || num <= 0) { toast.error("Valor inválido"); return }
    setLoading(true)
    await onSave(type, num)
    setEditing(false)
    setLoading(false)
  }

  return (
    <Card className={achieved ? "border-green-500/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color }} />
            {label}
          </div>
          {achieved && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Meta atingida!
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        {target ? (
          <>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">
                  {unit === "BRL" ? formatMoney(actual) : `${actual.toFixed(1)}${unit}`}
                </span>
                <span className="font-semibold">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>Meta: {unit === "BRL" ? formatMoney(target) : `${target}${unit}`}</span>
              </div>
            </div>
            {!achieved && remaining !== null && (
              <p className="text-sm text-muted-foreground">
                Faltam <span className="font-semibold text-foreground">
                  {unit === "BRL" ? formatMoney(remaining) : `${remaining.toFixed(1)}${unit}`}
                </span> para atingir a meta
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma meta definida para este mês.</p>
        )}

        {/* Edit */}
        {editing ? (
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                Nova meta ({unit === "BRL" ? "R$" : unit})
              </Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="flex gap-1 items-end">
              <Button size="sm" onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => { setValue(target ? String(target) : ""); setEditing(true) }}>
            {target ? "Editar meta" : "Definir meta"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function MetasClient({ goals, currentMonth, actualHours, actualRevenue, totalExpenses }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const currentDate = parseISO(currentMonth + "-01")
  const prevMonth   = format(subMonths(currentDate, 1), "yyyy-MM")
  const nextMonth   = format(addMonths(currentDate, 1), "yyyy-MM")
  const monthLabel  = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })

  const revenueGoal = goals.find(g => g.type === "revenue_month")
  const hoursGoal   = goals.find(g => g.type === "hours_month")

  async function handleSaveGoal(type: string, target: number) {
    const { data: { user } } = await supabase.auth.getUser()
    const existing = goals.find(g => g.type === type)

    if (existing) {
      const { error } = await supabase.from("user_goals").update({ target }).eq("id", existing.id)
      if (error) { toast.error("Erro ao salvar meta"); return }
    } else {
      const { error } = await supabase.from("user_goals").insert({
        user_id: user!.id, type, target, period: currentMonth,
      })
      if (error) { toast.error("Erro ao criar meta"); return }
    }

    toast.success("Meta salva!")
    router.refresh()
  }

  const netRevenue = actualRevenue - totalExpenses

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Metas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Defina e acompanhe objetivos mensais</p>
        </div>
        <div className="flex items-center border rounded-lg h-9">
          <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/metas?month=${prevMonth}`)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3 capitalize min-w-36 text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-9 w-8" onClick={() => router.push(`/metas?month=${nextMonth}`)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Receita bruta</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(actualRevenue)}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Despesas</p>
          <p className="text-xl font-bold text-destructive">{formatMoney(totalExpenses)}</p>
        </div>
        <div className="border rounded-xl p-4 bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Lucro líquido</p>
          <p className={`text-xl font-bold ${netRevenue >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatMoney(netRevenue)}
          </p>
        </div>
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GoalCard
          label="Meta de receita"
          icon={TrendingUp}
          type="revenue_month"
          target={revenueGoal?.target ?? null}
          actual={actualRevenue}
          unit="BRL"
          color="#22c55e"
          onSave={handleSaveGoal}
        />
        <GoalCard
          label="Meta de horas"
          icon={Clock}
          type="hours_month"
          target={hoursGoal?.target ?? null}
          actual={actualHours}
          unit="h"
          color="#3b82f6"
          onSave={handleSaveGoal}
        />
      </div>

      {/* Tips */}
      <div className="border rounded-xl p-4 bg-muted/20 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Target className="w-4 h-4 text-primary" />
          Dicas para definir metas realistas
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Comece com base na média dos últimos 3 meses</li>
          <li>Considere feriados, férias e disponibilidade do mês</li>
          <li>Metas de receita devem considerar o valor líquido após impostos</li>
          <li>O progresso é atualizado em tempo real conforme você registra horas</li>
        </ul>
      </div>
    </div>
  )
}
