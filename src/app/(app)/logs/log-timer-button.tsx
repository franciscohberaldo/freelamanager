"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Play, Pause, Square } from "lucide-react"

interface Props {
  logId: string
  hoursWorked: number
}

export function LogTimerButton({ logId, hoursWorked }: Props) {
  const [active, setActive] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active])

  async function handleStop() {
    setActive(false)
    const addedHours = seconds / 3600
    const newHours = parseFloat((hoursWorked + addedHours).toFixed(2))
    setSeconds(0)

    const { error } = await supabase
      .from("daily_logs")
      .update({ hours_worked: newHours })
      .eq("id", logId)

    if (error) toast.error("Erro ao salvar tempo")
    else {
      toast.success(`+${(addedHours * 60).toFixed(0)}min adicionados às horas trabalhadas`)
      router.refresh()
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0")
  const display = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`

  if (active) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs tabular-nums text-orange-500 dark:text-orange-400 w-16">
          {display}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600"
          onClick={() => setActive(false)}
          title="Pausar"
        >
          <Pause className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
          onClick={handleStop}
          title="Parar e salvar"
        >
          <Square className="w-3.5 h-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
      onClick={() => setActive(true)}
      title="Iniciar timer"
    >
      <Play className="w-3.5 h-3.5 mr-1" />
      {seconds > 0 ? display : "Timer"}
    </Button>
  )
}
