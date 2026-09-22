"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

/** Asks Resend for what arrived since the last look and reloads the inbox with it. */
export function RefreshEmailsButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function refresh() {
    setLoading(true)
    const res = await fetch("/api/emails/refresh", { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? "Erro ao verificar e-mails"); return }
    // Say what went wrong, not just how often: a rejected API key reads very differently
    // from one message Resend had not finished processing.
    if (data.errors?.length && data.listed === 0) toast.error(`Não foi possível verificar os e-mails: ${data.errors[0]}`)
    else if (data.errors?.length) toast.warning(`${data.imported ?? 0} novo(s) e-mail(s), ${data.errors.length} com erro: ${data.errors[0]}`)
    else if (data.imported > 0) toast.success(`${data.imported} novo(s) e-mail(s)`)
    else toast.success("Caixa de entrada em dia")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Verificar e-mails
    </Button>
  )
}
