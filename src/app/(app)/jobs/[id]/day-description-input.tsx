"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

interface Props {
  logId: string
  logDate: string
  initialValue: string | null
}

/** Saves the work description when the person leaves the field. */
export function DayDescriptionInput({ logId, logDate, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "")
  const [savedValue, setSavedValue] = useState(initialValue?.trim() ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function save() {
    const nextValue = value.trim()
    if (nextValue === savedValue) {
      if (value !== nextValue) setValue(nextValue)
      return
    }

    setSaving(true)
    setSaved(false)
    setFailed(false)
    const { error } = await supabase
      .from("daily_logs")
      .update({ requests: nextValue || null })
      .eq("id", logId)

    setSaving(false)
    if (error) {
      setFailed(true)
      toast.error(`Não foi possível salvar a descrição de ${logDate}`)
      return
    }

    setValue(nextValue)
    setSavedValue(nextValue)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="mt-1.5">
      <div className="relative">
        <Input
          aria-label={`O que foi feito em ${logDate}`}
          value={value}
          onChange={event => {
            setValue(event.target.value)
            setSaved(false)
            setFailed(false)
          }}
          onBlur={save}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          disabled={saving}
          placeholder="O que foi feito no dia"
          className="h-8 bg-background/80 pr-8 text-xs"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {!saving && saved && <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />}
        </span>
      </div>
      <span className="sr-only" role="status">
        {saving ? "Salvando descrição" : saved ? "Descrição salva" : failed ? "A descrição não foi salva" : ""}
      </span>
      {failed && <p className="mt-1 text-xs text-destructive">Não foi possível salvar. Saia do campo para tentar novamente.</p>}
    </div>
  )
}
