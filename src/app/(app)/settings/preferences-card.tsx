"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const TIMER_KEY = "timer_max_hours"
const DEFAULT_MAX_HOURS = 8

/**
 * How the app behaves while you work, as opposed to who you are on an invoice. Both settle
 * on the spot — one preference per change, with nothing to press.
 */
export function PreferencesCard({ hourRounding }: { hourRounding: string }) {
  const supabase = createClient()
  const [rounding, setRounding] = useState(hourRounding)
  const [maxHours, setMaxHours] = useState<number>(DEFAULT_MAX_HOURS)

  // The timer's limit is this browser's business, so it never left localStorage.
  useEffect(() => {
    const stored = localStorage.getItem(TIMER_KEY)
    const parsed = stored === null ? NaN : parseFloat(stored)
    if (!Number.isNaN(parsed)) setMaxHours(parsed)
  }, [])

  async function saveRounding(value: string) {
    setRounding(value)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("user_settings")
      .upsert({ user_id: user!.id, hour_rounding: value }, { onConflict: "user_id" })
    if (error) { toast.error("Erro ao salvar o arredondamento"); setRounding(hourRounding); return }
    toast.success("Arredondamento salvo")
  }

  function onMaxHours(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    if (Number.isNaN(value) || value < 1 || value > 24) return
    setMaxHours(value)
    localStorage.setItem(TIMER_KEY, String(value))
  }

  return (
    <Card id="preferencias" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-base">Preferências</CardTitle>
        <CardDescription>Como o sistema se comporta enquanto você trabalha.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="hour_rounding" className="text-xs">Arredondamento de horas</Label>
          <Select value={rounding} onValueChange={saveRounding}>
            <SelectTrigger id="hour_rounding"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem arredondamento</SelectItem>
              <SelectItem value="0.25">Arredondar para 15 min</SelectItem>
              <SelectItem value="0.5">Arredondar para 30 min</SelectItem>
              <SelectItem value="1">Arredondar para 1 hora</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Aplicado às horas ao salvar um registro.</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="timer-max-hours" className="text-xs">Máximo de horas por dia (timer)</Label>
          <Input
            id="timer-max-hours"
            type="number" min={1} max={24} step={0.5}
            value={maxHours}
            onChange={onMaxHours}
          />
          <p className="text-xs text-muted-foreground">
            O timer avisa ao chegar nesse limite. Vale só neste navegador.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
