"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STORAGE_KEY = "timer_max_hours"
const DEFAULT_MAX_HOURS = 8

export function TimerSettings() {
  const [maxHours, setMaxHours] = useState<number>(DEFAULT_MAX_HOURS)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed)) {
        setMaxHours(parsed)
      }
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= 24) {
      setMaxHours(value)
      localStorage.setItem(STORAGE_KEY, String(value))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timer</CardTitle>
        <CardDescription>
          Configure o limite diário de horas para o timer. O timer exibirá um aviso ao atingir esse limite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 max-w-xs">
          <Label htmlFor="timer-max-hours">Máximo de horas por dia</Label>
          <Input
            id="timer-max-hours"
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={maxHours}
            onChange={handleChange}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">Entre 1 e 24 horas (incrementos de 0,5 h)</p>
        </div>
      </CardContent>
    </Card>
  )
}
