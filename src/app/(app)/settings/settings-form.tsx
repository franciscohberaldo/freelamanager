"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function SettingsForm() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error("Senhas não coincidem"); return }
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) toast.error("Erro ao alterar senha")
    else { toast.success("Senha alterada!"); setPassword(""); setConfirm("") }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nova senha</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="space-y-2">
        <Label>Confirmar senha</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Alterar senha
      </Button>
    </form>
  )
}
