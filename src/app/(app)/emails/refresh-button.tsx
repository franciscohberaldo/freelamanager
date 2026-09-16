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
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? "Erro ao atualizar"); return }
    if (data.errors?.length) toast.warning(`Atualizado com ${data.errors.length} erro(s)`)
    else if (data.imported > 0) toast.success(`${data.imported} novo(s) e-mail(s)`)
    else toast.success("Caixa de entrada em dia")
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Atualizar
    </Button>
  )
}
